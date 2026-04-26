import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlanService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePlanDto, userId: string) {
    await this.assertSuperAdmin(userId);
    const code = dto.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    const plan = await this.prisma.plan.create({
      data: {
        code,
        name: dto.name,
        priceCents: dto.price,
        currency: dto.currency.toUpperCase(),
        maxStreams: dto.maxStreams,
        billingCycle: 'monthly',
        features: dto.features as Prisma.InputJsonValue,
      },
    });

    return this.toResponse(plan);
  }

  async findAll() {
    const plans = await this.prisma.plan.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return plans.map((plan) => this.toResponse(plan));
  }

  async update(id: string, dto: UpdatePlanDto, userId: string) {
    await this.assertSuperAdmin(userId);
    const existing = await this.prisma.plan.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Plan not found');
    }

    const updated = await this.prisma.plan.update({
      where: { id },
      data: {
        name: dto.name,
        priceCents: dto.price,
        currency: dto.currency?.toUpperCase(),
        maxStreams: dto.maxStreams,
        features: dto.features as Prisma.InputJsonValue | undefined,
      },
    });

    return this.toResponse(updated);
  }

  private async assertSuperAdmin(userId: string): Promise<void> {
    const superAdminEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
    if (!superAdminEmail) {
      throw new ForbiddenException('Superadmin is not configured');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user || user.email.toLowerCase() !== superAdminEmail) {
      throw new ForbiddenException('Only superadmin can modify plans');
    }
  }

  private toResponse(plan: {
    id: string;
    code: string;
    name: string;
    priceCents: number;
    currency: string;
    maxStreams: number;
    features: unknown;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      price: plan.priceCents,
      currency: plan.currency,
      maxStreams: plan.maxStreams,
      features: plan.features,
      isActive: plan.isActive,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}
