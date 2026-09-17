import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { requestContext } from '../common/context/request-context';
import { FeesService } from './fees.service';

/** Nightly overdue flagging across every active school. */
@Injectable()
export class FeesCron {
  private readonly logger = new Logger(FeesCron.name);
  constructor(
    private prisma: PrismaService,
    private fees: FeesService,
  ) {}

  @Cron('15 1 * * *')
  async markOverdue() {
    const tenants = await this.prisma.platform.tenant.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
    let total = 0;
    for (const t of tenants) {
      await requestContext.run({ tenantId: t.id, actorType: 'SYSTEM', actorName: 'scheduler' }, async () => {
        total += await this.fees.markOverdue();
      });
    }
    if (total) this.logger.log(`Flagged ${total} overdue invoices`);
  }
}
