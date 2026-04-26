import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LicenseStatus, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { CreateLicenseDto } from './dto/create-license.dto';
import { BuildLicenseDto } from './dto/build-license.dto';
import { UpdateLicenseDto } from './dto/update-license.dto';
import { PricingService } from './pricing.service';

@Injectable()
export class LicenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  async create(dto: CreateLicenseDto, userId: string) {
    return this.checkoutLicense(dto, userId);
  }

  async getFeatures() {
    return this.prisma.feature.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: {
        key: true,
        name: true,
        priceCents: true,
        unit: true,
        active: true,
      },
    });
  }

  async buildLicense(dto: BuildLicenseDto, userId: string) {
    await this.assertOrganizationAdminAccess(dto.organizationId, userId);
    const featureMap = await this.getFeatureMap(dto.items.map((item) => item.featureKey));
    const pricingInputs = dto.items.map((item) => {
      const feature = featureMap.get(item.featureKey);
      if (!feature) {
        throw new NotFoundException(`Feature not found: ${item.featureKey}`);
      }
      return {
        key: feature.key,
        priceCents: feature.priceCents,
        unit: feature.unit,
        quantity: item.quantity,
      };
    });
    const pricing = this.pricingService.calculateTotalPrice(pricingInputs, dto.duration);
    const currencyConfig = await this.platformSettings.getCurrencyConfig();
    const baseCurrency = currencyConfig.baseCurrency;
    const targetCurrency =
      dto.currency?.toUpperCase() ?? baseCurrency;
    const convertedItems = pricing.breakdown.map((item) => ({
      ...item,
      unitPriceCents: this.platformSettings.convertAmountCents(
        item.unitPriceCents,
        baseCurrency,
        targetCurrency,
        currencyConfig,
      ),
      subtotalCents: this.platformSettings.convertAmountCents(
        item.subtotalCents,
        baseCurrency,
        targetCurrency,
        currencyConfig,
      ),
    }));
    const convertedSubtotal = this.platformSettings.convertAmountCents(
      pricing.subtotalCents,
      baseCurrency,
      targetCurrency,
      currencyConfig,
    );
    const convertedTotal = this.platformSettings.convertAmountCents(
      pricing.totalCents,
      baseCurrency,
      targetCurrency,
      currencyConfig,
    );

    return {
      organizationId: dto.organizationId,
      currency: targetCurrency,
      baseCurrency,
      duration: dto.duration,
      subtotalCents: convertedSubtotal,
      totalCents: convertedTotal,
      durationMultiplier: pricing.durationMultiplier,
      items: convertedItems,
    };
  }

  async checkoutLicense(dto: CreateLicenseDto, userId: string) {
    await this.assertOrganizationAdminAccess(dto.organizationId, userId);
    return this.issueLicenseAfterPayment(dto);
  }

  /**
   * Creates a license from a feature bundle (used after successful payment webhook).
   * Does not perform membership checks.
   */
  async issueLicenseAfterPayment(dto: CreateLicenseDto) {
    const featureMap = await this.getFeatureMap(dto.items.map((item) => item.featureKey));
    const key = await this.generateUniqueKey();
    const now = new Date();
    const defaultExpiresAt =
      dto.duration === 'yearly'
        ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const license = await this.prisma.license.create({
      data: {
        organizationId: dto.organizationId,
        key,
        seats: dto.seats ?? 1,
        startsAt: now,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : defaultExpiresAt,
        items: {
          create: dto.items.map((item) => {
            const feature = featureMap.get(item.featureKey);
            if (!feature) {
              throw new NotFoundException(`Feature not found: ${item.featureKey}`);
            }
            return {
              featureKey: feature.key,
              quantity: item.quantity,
            };
          }),
        },
      },
      include: {
        organization: true,
        items: {
          include: { feature: true },
        },
      },
    });
    return this.toLicenseResponse(license);
  }

  async findAllForUser(userId: string) {
    const superAdmin = await this.userIsSuperAdmin(userId);
    const whereClause = superAdmin
      ? {}
      : {
          organization: {
            memberships: {
              some: { userId },
            },
          },
        };
    const licenses = await this.prisma.license.findMany({
      where: whereClause,
      include: {
        organization: true,
        items: {
          include: { feature: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return licenses.map((license) => this.toLicenseResponse(license));
  }

  async findByKeyForUser(key: string, userId: string) {
    const superAdmin = await this.userIsSuperAdmin(userId);
    const license = superAdmin
      ? await this.prisma.license.findUnique({
          where: { key },
          include: {
            organization: true,
            items: {
              include: { feature: true },
            },
          },
        })
      : await this.prisma.license.findFirst({
          where: {
            key,
            organization: {
              memberships: {
                some: { userId },
              },
            },
          },
          include: {
            organization: true,
            items: {
              include: { feature: true },
            },
          },
        });

    if (!license) {
      throw new NotFoundException('License not found');
    }

    return this.toLicenseResponse(license);
  }

  async updateLicense(key: string, dto: UpdateLicenseDto, userId: string) {
    if (dto.status === undefined && dto.expiresAt === undefined) {
      throw new BadRequestException('Provide status and/or expiresAt');
    }

    const existing = await this.prisma.license.findUnique({
      where: { key },
      select: { organizationId: true },
    });
    if (!existing) {
      throw new NotFoundException('License not found');
    }

    await this.assertOrganizationAdminAccess(existing.organizationId, userId);

    const license = await this.prisma.license.update({
      where: { key },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: new Date(dto.expiresAt) }
          : {}),
      },
      include: {
        organization: true,
        items: {
          include: { feature: true },
        },
      },
    });

    return this.toLicenseResponse(license);
  }

  async validateByKey(key: string) {
    const license = await this.prisma.license.findUnique({
      where: { key },
      include: {
        items: {
          include: { feature: true },
        },
      },
    });

    if (!license) {
      return {
        valid: false,
        features: {},
      };
    }

    const now = new Date();
    const isExpired = license.expiresAt ? license.expiresAt < now : false;
    const isSuspended = license.status === LicenseStatus.SUSPENDED;
    const isRevoked = license.status === LicenseStatus.REVOKED;
    const isStatusExpired = license.status === LicenseStatus.EXPIRED;
    const valid = !(isExpired || isSuspended || isRevoked || isStatusExpired);
    const features = this.toFeaturePayload(license.items);

    return {
      valid,
      features,
      expiresAt: license.expiresAt,
    };
  }

  private async assertOrganizationAccess(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
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

  private async assertOrganizationAdminAccess(
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

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
      select: { role: true },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }
    if (membership.role !== Role.OWNER && membership.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only organization admins can manage licenses',
      );
    }
  }

  private async getFeatureMap(featureKeys: string[]) {
    const features = await this.prisma.feature.findMany({
      where: { key: { in: featureKeys }, active: true },
    });
    return new Map(features.map((feature) => [feature.key, feature]));
  }

  private async generateUniqueKey(): Promise<string> {
    for (let i = 0; i < 5; i += 1) {
      const key = `LC-${randomBytes(12).toString('hex').toUpperCase()}`;
      const existing = await this.prisma.license.findUnique({
        where: { key },
        select: { id: true },
      });
      if (!existing) {
        return key;
      }
    }

    throw new Error('Could not generate unique license key');
  }

  private toFeaturePayload(
    items: Array<{
      quantity: number;
      feature: { key: string; unit: 'per_stream' | 'flat' };
    }>,
  ): Record<string, number | boolean> {
    const payload: Record<string, number | boolean> = {};
    for (const item of items) {
      payload[item.feature.key] =
        item.feature.unit === 'per_stream' ? item.quantity : item.quantity > 0;
    }
    return payload;
  }

  private toLicenseResponse(license: {
    id: string;
    key: string;
    status: LicenseStatus;
    seats: number;
    startsAt: Date;
    expiresAt: Date | null;
    organizationId: string;
    organization?: { id: string; name: string; slug: string };
    items: Array<{
      featureKey: string;
      quantity: number;
      feature: {
        key: string;
        name: string;
        priceCents: number;
        unit: 'per_stream' | 'flat';
      };
    }>;
  }) {
    return {
      id: license.id,
      key: license.key,
      status: license.status,
      seats: license.seats,
      startsAt: license.startsAt,
      expiresAt: license.expiresAt,
      organizationId: license.organizationId,
      organization: license.organization
        ? {
            id: license.organization.id,
            name: license.organization.name,
            slug: license.organization.slug,
          }
        : undefined,
      items: license.items.map((item) => ({
        featureKey: item.featureKey,
        quantity: item.quantity,
        name: item.feature.name,
        unit: item.feature.unit,
        priceCents: item.feature.priceCents,
      })),
      features: this.toFeaturePayload(license.items),
    };
  }
}
