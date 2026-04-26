import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FeatureUnit,
  LicenseStatus,
  Prisma,
  Role,
  TransactionStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { InitializeLicensePaymentDto } from './dto/initialize-license-payment.dto';
import { LicenseService } from '../license/license.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import {
  PaymentProvider,
  PaymentProviderName,
} from './providers/payment-provider.interface';
import { PAYMENT_PROVIDERS } from './payment.constants';

const LICENSE_BUNDLE_KIND = 'license_bundle' as const;
const PAYSTACK_DEFAULT_CURRENCY = 'GHS' as const;

type LicenseBundleMetadata = {
  checkoutKind: typeof LICENSE_BUNDLE_KIND;
  organizationId: string;
  userId: string;
  duration: 'monthly' | 'yearly';
  items: Array<{ featureKey: string; quantity: number }>;
  seats?: number;
  expiresAt?: string | null;
  expectedTotalCents?: number;
  currency?: string;
};

@Injectable()
export class PaymentService {
  private readonly providers = new Map<PaymentProviderName, PaymentProvider>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseService: LicenseService,
    private readonly platformSettings: PlatformSettingsService,
    @Inject(PAYMENT_PROVIDERS) providers: PaymentProvider[],
  ) {
    for (const provider of providers) {
      this.providers.set(provider.name, provider);
    }
  }

  async initializePayment(dto: InitializePaymentDto, user: CurrentUserPayload) {
    await this.assertOrgAdmin(dto.organizationId, user.userId);
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const provider = this.getProvider(dto.provider);
    const providerRef = `${dto.provider.toUpperCase()}_${Date.now()}_${randomBytes(4).toString('hex')}`;

    const payer = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true },
    });

    const requestedOrDefaultCurrency = this.resolveCheckoutCurrency(
      dto.provider,
      dto.currency,
      plan.currency,
    );
    const currencyConfig = await this.platformSettings.getCurrencyConfig();
    const amountCents = this.platformSettings.convertAmountCents(
      plan.priceCents,
      plan.currency,
      requestedOrDefaultCurrency,
      currencyConfig,
    );

    const init = await provider.initializePayment({
      amountCents,
      currency: requestedOrDefaultCurrency,
      email: payer?.email ?? 'customer@leocastra.local',
      reference: providerRef,
      metadata: {
        organizationId: dto.organizationId,
        planId: dto.planId,
        userId: user.userId,
      },
    });

    const transaction = await this.prisma.transaction.create({
      data: {
        organizationId: dto.organizationId,
        userId: user.userId,
        planId: dto.planId,
        provider: dto.provider,
        providerRef: init.providerRef,
        amountCents,
        currency: requestedOrDefaultCurrency,
        status: TransactionStatus.PENDING,
        metadata: init.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    return {
      transactionId: transaction.id,
      provider: dto.provider,
      providerRef: init.providerRef,
      authorizationUrl: init.authorizationUrl,
      status: transaction.status,
    };
  }

  async initializeLicensePayment(
    dto: InitializeLicensePaymentDto,
    user: CurrentUserPayload,
  ) {
    await this.assertOrgAdminOrSuperAdmin(dto.organizationId, user.userId);
    const currency = this.resolveCheckoutCurrency(dto.provider, dto.currency);
    const quote = await this.licenseService.buildLicense(
      { ...dto, currency },
      user.userId,
    );
    const payer = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true },
    });

    const provider = this.getProvider(dto.provider);
    const providerRef = `LCCHK_${Date.now()}_${randomBytes(4).toString('hex')}`;

    const bundleMeta: LicenseBundleMetadata = {
      checkoutKind: LICENSE_BUNDLE_KIND,
      organizationId: dto.organizationId,
      userId: user.userId,
      duration: dto.duration,
      items: dto.items,
      seats: dto.seats ?? 1,
      expiresAt: dto.expiresAt ?? null,
      expectedTotalCents: quote.totalCents,
      currency: quote.currency,
    };

    const init = await provider.initializePayment({
      amountCents: quote.totalCents,
      currency: quote.currency,
      email: payer?.email ?? 'customer@leocastra.local',
      reference: providerRef,
      metadata: bundleMeta as unknown as Record<string, unknown>,
    });

    const transaction = await this.prisma.transaction.create({
      data: {
        organizationId: dto.organizationId,
        userId: user.userId,
        planId: null,
        provider: dto.provider,
        providerRef: init.providerRef,
        amountCents: quote.totalCents,
        currency: quote.currency,
        status: TransactionStatus.PENDING,
        metadata: bundleMeta as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      transactionId: transaction.id,
      provider: dto.provider,
      providerRef: init.providerRef,
      authorizationUrl: init.authorizationUrl,
      status: transaction.status,
      totalCents: quote.totalCents,
      currency: quote.currency,
    };
  }

  async handleWebhook(
    providerName: PaymentProviderName,
    payload: unknown,
    signature?: string,
  ) {
    const provider = this.getProvider(providerName);
    const result = await provider.handleWebhook(payload, signature);
    if (!result.providerRef) {
      throw new BadRequestException('provider reference missing in webhook payload');
    }

    const transaction = await this.prisma.transaction.findFirst({
      where: {
        provider: providerName,
        providerRef: result.providerRef,
      },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found for webhook');
    }

    const nextStatus = result.successful
      ? TransactionStatus.SUCCEEDED
      : TransactionStatus.FAILED;

    const prevMeta =
      transaction.metadata &&
      typeof transaction.metadata === 'object' &&
      !Array.isArray(transaction.metadata)
        ? (transaction.metadata as Record<string, unknown>)
        : {};
    const mergedMeta = {
      ...prevMeta,
      webhook: result.raw ?? {},
    };

    const updated = await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: nextStatus,
        metadata: mergedMeta as Prisma.InputJsonValue,
      },
    });

    if (nextStatus === TransactionStatus.SUCCEEDED && !transaction.licenseId) {
      await this.createOrUpdateLicense(updated.id);
    }

    return {
      received: true,
      transactionId: updated.id,
      status: updated.status,
    };
  }

  getTransactionsForUser(userId: string) {
    return this.prisma.transaction.findMany({
      where: {
        organization: {
          memberships: {
            some: { userId },
          },
        },
      },
      include: {
        plan: true,
        license: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async createOrUpdateLicense(transactionId: string): Promise<void> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        plan: true,
      },
    });
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    const meta = tx.metadata as Record<string, unknown> | null;
    if (meta?.checkoutKind === LICENSE_BUNDLE_KIND) {
      await this.fulfillLicenseBundle(tx, meta as unknown as LicenseBundleMetadata);
      return;
    }

    if (!tx.plan) {
      throw new BadRequestException('Transaction is missing plan or bundle metadata');
    }

    const activeLicense = await this.prisma.license.findFirst({
      where: {
        organizationId: tx.organizationId,
        status: LicenseStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 30);
    const licenseItems = await this.buildLicenseItemsFromPlan(
      tx.plan.features,
      tx.plan.maxStreams,
    );

    if (activeLicense) {
      const updatedLicense = await this.prisma.license.update({
        where: { id: activeLicense.id },
        data: {
          status: LicenseStatus.ACTIVE,
          startsAt: now,
          expiresAt,
          items: {
            deleteMany: {},
            create: licenseItems,
          },
        },
      });

      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: { licenseId: updatedLicense.id },
      });
      return;
    }

    const license = await this.prisma.license.create({
      data: {
        organizationId: tx.organizationId,
        key: `LC-${randomBytes(12).toString('hex').toUpperCase()}`,
        status: LicenseStatus.ACTIVE,
        startsAt: now,
        expiresAt,
        items: {
          create: licenseItems,
        },
      },
    });

    await this.prisma.transaction.update({
      where: { id: tx.id },
      data: { licenseId: license.id },
    });
  }

  private async fulfillLicenseBundle(
    tx: { id: string; amountCents: number },
    meta: LicenseBundleMetadata,
  ): Promise<void> {
    if (
      typeof meta.expectedTotalCents === 'number' &&
      meta.expectedTotalCents !== tx.amountCents
    ) {
      throw new BadRequestException('License checkout amount mismatch');
    }
    if (!Array.isArray(meta.items) || meta.items.length === 0) {
      throw new BadRequestException('Invalid license bundle items');
    }

    const license = await this.licenseService.issueLicenseAfterPayment({
      organizationId: meta.organizationId,
      items: meta.items,
      duration: meta.duration,
      seats: meta.seats ?? 1,
      expiresAt: meta.expiresAt ?? undefined,
    });

    await this.prisma.transaction.update({
      where: { id: tx.id },
      data: { licenseId: license.id },
    });
  }

  private resolveCheckoutCurrency(
    provider: PaymentProviderName,
    requestedCurrency?: string,
    fallbackCurrency = 'USD',
  ): string {
    if (requestedCurrency?.trim()) {
      return requestedCurrency.trim().toUpperCase();
    }
    if (provider === 'paystack') {
      return PAYSTACK_DEFAULT_CURRENCY;
    }
    return fallbackCurrency.toUpperCase();
  }

  private getProvider(name: PaymentProviderName): PaymentProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new BadRequestException(`Unsupported payment provider: ${name}`);
    }
    return provider;
  }

  private async buildLicenseItemsFromPlan(
    rawFeatures: Prisma.JsonValue,
    maxStreams: number,
  ): Promise<Array<{ featureKey: string; quantity: number }>> {
    const features = await this.prisma.feature.findMany({
      where: { active: true },
      select: { key: true, unit: true },
    });
    const featureMap = new Map(features.map((feature) => [feature.key, feature.unit]));
    const planFeatures =
      rawFeatures && typeof rawFeatures === 'object' && !Array.isArray(rawFeatures)
        ? (rawFeatures as Record<string, unknown>)
        : {};

    const items: Array<{ featureKey: string; quantity: number }> = [];

    for (const [featureKey, unit] of featureMap.entries()) {
      if (unit === FeatureUnit.per_stream) {
        const raw = planFeatures[featureKey];
        const count =
          typeof raw === 'number' && Number.isFinite(raw)
            ? Math.max(0, Math.floor(raw))
            : maxStreams;
        if (count > 0) {
          items.push({ featureKey, quantity: count });
        }
        continue;
      }

      const enabled = planFeatures[featureKey];
      if (enabled === true) {
        items.push({ featureKey, quantity: 1 });
      }
    }

    return items;
  }

  private async assertOrgMembership(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('You do not belong to this organization');
    }
  }

  private async assertOrgAdmin(organizationId: string, userId: string): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      select: { role: true },
    });
    if (!membership) {
      throw new ForbiddenException('You do not belong to this organization');
    }
    if (membership.role !== Role.OWNER && membership.role !== Role.ADMIN) {
      throw new ForbiddenException('Only organization admins can initialize payment');
    }
  }

  private async userIsSuperAdmin(userId: string): Promise<boolean> {
    const superAdminEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
    if (!superAdminEmail) {
      return false;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return !!user && user.email.toLowerCase() === superAdminEmail;
  }

  private async assertOrgAdminOrSuperAdmin(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    if (await this.userIsSuperAdmin(userId)) {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });
      if (!org) {
        throw new NotFoundException('Organization not found');
      }
      return;
    }
    await this.assertOrgAdmin(organizationId, userId);
  }
}
