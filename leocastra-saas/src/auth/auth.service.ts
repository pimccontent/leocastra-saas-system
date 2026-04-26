import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateCredentialsDto } from './dto/update-credentials.dto';

type JwtPayload = {
  userId: string;
  organizationId: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Email is already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const slugBase = dto.organizationName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const slug = `${slugBase || 'org'}-${randomUUID().slice(0, 8)}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          passwordHash,
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName,
          slug,
          ownerId: user.id,
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: Role.ADMIN,
        },
      });

      return { userId: user.id, organizationId: organization.id };
    });

    return { accessToken: await this.signToken(result) };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        passwordHash: true,
        memberships: {
          orderBy: { createdAt: 'asc' },
          select: { organizationId: true },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException('User has no organization membership');
    }

    return {
      accessToken: await this.signToken({
        userId: user.id,
        organizationId: membership.organizationId,
      }),
    };
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        memberships: {
          orderBy: { createdAt: 'asc' },
          select: {
            role: true,
            organizationId: true,
          },
          take: 1,
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const superAdminEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
    const organizationRole = user.memberships[0]?.role ?? null;
    const organizationId = user.memberships[0]?.organizationId ?? null;
    const platformRole =
      superAdminEmail && user.email.toLowerCase() === superAdminEmail
        ? 'OWNER'
        : 'ADMIN';

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      platformRole,
      organizationRole,
      organizationId,
    };
  }

  async updateCredentials(userId: string, dto: UpdateCredentialsDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordOk = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const email = dto.email?.trim().toLowerCase();
    if (email && email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('Email is already in use');
      }
    }

    const nextPasswordHash = dto.newPassword
      ? await bcrypt.hash(dto.newPassword, 10)
      : undefined;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: email ?? undefined,
        passwordHash: nextPasswordHash,
      },
      select: {
        id: true,
        email: true,
      },
    });

    return {
      message: 'Credentials updated successfully',
      user: updated,
    };
  }

  private async signToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }
}
