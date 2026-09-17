import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_PLANS } from '../common/features';

/** First-run bootstrap: creates the platform owner account and default plans from environment variables. */
@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const users = await this.prisma.platform.platformUser.count();
      if (users === 0) {
        const email = (process.env.PLATFORM_ADMIN_EMAIL || 'admin@schoolos.app').toLowerCase();
        const password = process.env.PLATFORM_ADMIN_PASSWORD || 'ChangeMe123!';
        await this.prisma.platform.platformUser.create({
          data: {
            email,
            name: process.env.PLATFORM_ADMIN_NAME || 'Platform Owner',
            passwordHash: await bcrypt.hash(password, 10),
            role: 'SUPER_ADMIN',
          },
        });
        this.logger.warn(`Created platform admin ${email}. Change the password after first login.`);
      }
      const plans = await this.prisma.platform.plan.count();
      if (plans === 0) {
        for (const p of DEFAULT_PLANS) await this.prisma.platform.plan.create({ data: p });
        this.logger.log(`Created ${DEFAULT_PLANS.length} default subscription plans`);
      }
    } catch (e) {
      this.logger.error(`Bootstrap failed (is the database migrated?): ${(e as Error).message}`);
    }
  }
}
