import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { AdminUpdateFeatureDto } from './dto/admin-update-feature.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { GenerateLicenseKeysDto } from './dto/generate-license-keys.dto';
import { GenerateLicensesDto } from './dto/generate-licenses.dto';
import { LicenseService } from '../license/license.service';

const REMOVED_FEATURE_KEYS = new Set([
  'abr',
  'abr_hls',
  'signed_hls',
  'webrtc',
  'sign_hls',
]);

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly licenseService: LicenseService,
  ) {}

  async getOverview(userId: string) {
    await this.assertSuperAdmin(userId);

    const [
      totalCustomers,
      totalOrganizations,
      totalLicenses,
      activeLicenses,
      totalTransactions,
      successfulTransactions,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.organization.count(),
      this.prisma.license.count(),
      this.prisma.license.count({ where: { status: 'ACTIVE' } }),
      this.prisma.transaction.count(),
      this.prisma.transaction.findMany({
        where: { status: 'SUCCEEDED' },
        select: { amountCents: true },
      }),
    ]);

    const revenueCents = successfulTransactions.reduce(
      (sum, tx) => sum + tx.amountCents,
      0,
    );

    return {
      totalCustomers,
      totalOrganizations,
      totalLicenses,
      activeLicenses,
      totalTransactions,
      revenueCents,
    };
  }

  async getCustomers(userId: string) {
    await this.assertSuperAdmin(userId);

    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        memberships: {
          select: { id: true },
        },
        licenses: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
  }

  async getTransactions(userId: string) {
    await this.assertSuperAdmin(userId);

    return this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  async updateTransaction(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ) {
    await this.assertSuperAdmin(userId);
    const existing = await this.prisma.transaction.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }
    return this.prisma.transaction.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.amountCents !== undefined ? { amountCents: dto.amountCents } : {}),
        ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        user: {
          select: { id: true, email: true },
        },
        plan: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async deleteTransaction(userId: string, id: string) {
    await this.assertSuperAdmin(userId);
    const existing = await this.prisma.transaction.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }
    await this.prisma.transaction.delete({ where: { id } });
    return { deleted: true, id };
  }

  async getPlatformSettings(userId: string) {
    await this.assertSuperAdmin(userId);
    const row = await this.platformSettings.getRaw();
    const configured = (v: string | null | undefined) => !!(v && v.trim().length > 0);
    return {
      site: {
        title: row.siteTitle,
        description: row.siteDescription,
        logoUrl: row.siteLogoUrl,
        faviconUrl: row.siteFaviconUrl,
      },
      seo: {
        metaTitle: row.seoMetaTitle,
        metaDescription: row.seoMetaDescription,
        keywords:
          row.seoKeywords &&
          Array.isArray(row.seoKeywords)
            ? row.seoKeywords
            : [],
      },
      billing: {
        baseCurrency: row.billingBaseCurrency?.toUpperCase() || 'USD',
        exchangeRates:
          row.exchangeRates &&
          typeof row.exchangeRates === 'object' &&
          !Array.isArray(row.exchangeRates)
            ? row.exchangeRates
            : { USD: 1, GHS: 15 },
      },
      paystack: {
        publicKey: row.paystackPublicKey,
        callbackUrl: row.paystackCallbackUrl,
        secretKeyConfigured: configured(row.paystackSecretKey),
        webhookSecretConfigured: configured(row.paystackWebhookSecret),
      },
      binancePay: {
        apiKey: row.binancePayApiKey,
        merchantId: row.binancePayMerchantId,
        secretKeyConfigured: configured(row.binancePaySecretKey),
        webhookSecretConfigured: configured(row.binancePayWebhookSecret),
      },
    };
  }

  async updatePlatformSettings(userId: string, dto: UpdatePlatformSettingsDto) {
    await this.assertSuperAdmin(userId);
    const data: Prisma.PlatformSettingsUpdateInput = {};
    if (dto.billingBaseCurrency !== undefined) {
      data.billingBaseCurrency = dto.billingBaseCurrency.trim().toUpperCase() || 'USD';
    }
    if (dto.exchangeRates !== undefined) {
      const normalized: Record<string, number> = {};
      for (const [key, value] of Object.entries(dto.exchangeRates)) {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
          normalized[key.trim().toUpperCase()] = value;
        }
      }
      data.exchangeRates = normalized as Prisma.InputJsonValue;
    }
    if (dto.siteTitle !== undefined) {
      data.siteTitle = dto.siteTitle.trim() || null;
    }
    if (dto.siteDescription !== undefined) {
      data.siteDescription = dto.siteDescription.trim() || null;
    }
    if (dto.siteLogoUrl !== undefined) {
      data.siteLogoUrl = dto.siteLogoUrl.trim() || null;
    }
    if (dto.siteFaviconUrl !== undefined) {
      data.siteFaviconUrl = dto.siteFaviconUrl.trim() || null;
    }
    if (dto.seoMetaTitle !== undefined) {
      data.seoMetaTitle = dto.seoMetaTitle.trim() || null;
    }
    if (dto.seoMetaDescription !== undefined) {
      data.seoMetaDescription = dto.seoMetaDescription.trim() || null;
    }
    if (dto.seoKeywords !== undefined) {
      data.seoKeywords = dto.seoKeywords
        .map((keyword) => keyword.trim())
        .filter(Boolean) as Prisma.InputJsonValue;
    }
    if (dto.paystackPublicKey !== undefined) {
      data.paystackPublicKey = dto.paystackPublicKey.trim() || null;
    }
    if (dto.paystackSecretKey !== undefined) {
      data.paystackSecretKey = dto.paystackSecretKey.trim() || null;
    }
    if (dto.paystackCallbackUrl !== undefined) {
      data.paystackCallbackUrl = dto.paystackCallbackUrl.trim() || null;
    }
    if (dto.paystackWebhookSecret !== undefined) {
      data.paystackWebhookSecret = dto.paystackWebhookSecret.trim() || null;
    }
    if (dto.binancePayApiKey !== undefined) {
      data.binancePayApiKey = dto.binancePayApiKey.trim() || null;
    }
    if (dto.binancePaySecretKey !== undefined) {
      data.binancePaySecretKey = dto.binancePaySecretKey.trim() || null;
    }
    if (dto.binancePayMerchantId !== undefined) {
      data.binancePayMerchantId = dto.binancePayMerchantId.trim() || null;
    }
    if (dto.binancePayWebhookSecret !== undefined) {
      data.binancePayWebhookSecret = dto.binancePayWebhookSecret.trim() || null;
    }
    await this.platformSettings.updateFields(data);
    return this.getPlatformSettings(userId);
  }

  async listCatalogFeatures(userId: string) {
    await this.assertSuperAdmin(userId);
    const features = await this.prisma.feature.findMany({
      orderBy: { name: 'asc' },
    });
    return features.filter((feature) => !REMOVED_FEATURE_KEYS.has(feature.key));
  }

  async updateCatalogFeature(
    userId: string,
    key: string,
    dto: AdminUpdateFeatureDto,
  ) {
    await this.assertSuperAdmin(userId);
    const existing = await this.prisma.feature.findUnique({ where: { key } });
    if (!existing) {
      throw new NotFoundException(`Feature not found: ${key}`);
    }
    return this.prisma.feature.update({
      where: { key },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
      },
    });
  }

  async generateLicenseKeys(userId: string, dto: GenerateLicenseKeysDto) {
    await this.assertSuperAdmin(userId);
    const note = dto.note?.trim() || null;

    const keys: string[] = [];
    for (let i = 0; i < dto.count; i += 1) {
      keys.push(await this.generateUniquePoolKey());
    }

    await this.prisma.licenseKeyPool.createMany({
      data: keys.map((key) => ({
        key,
        note,
        createdById: userId,
      })),
    });

    return {
      count: keys.length,
      keys,
    };
  }

  async generateLicenses(userId: string, dto: GenerateLicensesDto) {
    await this.assertSuperAdmin(userId);
    const note = dto.note?.trim() || undefined;

    const created: Array<{
      id: string;
      key: string;
      status: string;
      organizationId: string;
      expiresAt: Date | null;
      note?: string;
    }> = [];
    for (let i = 0; i < dto.count; i += 1) {
      const license = await this.licenseService.issueLicenseAfterPayment({
        organizationId: dto.organizationId,
        items: dto.items,
        duration: dto.duration,
        currency: dto.currency,
        seats: dto.seats,
        expiresAt: dto.expiresAt,
      });
      created.push({
        id: license.id,
        key: license.key,
        status: license.status,
        organizationId: license.organizationId,
        expiresAt: license.expiresAt,
        note,
      });
    }

    return {
      count: created.length,
      licenses: created,
    };
  }

  async assertSuperAdmin(userId: string): Promise<void> {
    const superAdminEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
    if (!superAdminEmail) {
      throw new ForbiddenException('Superadmin is not configured');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user || user.email.toLowerCase() !== superAdminEmail) {
      throw new ForbiddenException('Owner access required');
    }
  }

  private async generateUniquePoolKey(): Promise<string> {
    for (let i = 0; i < 5; i += 1) {
      const key = `LC-${randomBytes(12).toString('hex').toUpperCase()}`;
      const exists = await this.prisma.licenseKeyPool.findUnique({
        where: { key },
        select: { id: true },
      });
      if (!exists) {
        return key;
      }
    }
    throw new Error('Could not generate unique license key');
  }
}
