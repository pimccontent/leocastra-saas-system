import { Injectable, OnModuleInit } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuperadminBootstrapService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SUPERADMIN_PASSWORD?.trim();
    if (!email || !password) {
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const orgSlug = `superadmin-${randomUUID().slice(0, 8)}`;

    await this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            firstName: 'Super',
            lastName: 'Admin',
            passwordHash,
          },
        });
      }

      const orgMembership = await tx.membership.findFirst({
        where: { userId: user.id },
        include: { organization: true },
      });

      let organizationId = orgMembership?.organizationId;
      if (!organizationId) {
        const org = await tx.organization.create({
          data: {
            name: 'Super Admin Organization',
            slug: orgSlug,
            ownerId: user.id,
          },
        });
        organizationId = org.id;
      }

      const membership = await tx.membership.findUnique({
        where: {
          userId_organizationId: { userId: user.id, organizationId },
        },
      });

      if (!membership) {
        await tx.membership.create({
          data: {
            userId: user.id,
            organizationId,
            role: Role.OWNER,
          },
        });
      }
    });
  }
}
