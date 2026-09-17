import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ctx } from '../common/context/request-context';
import { toJson, paginate } from '../common/utils';

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string;
  before?: any;
  after?: any;
  reason?: string;
  tenantId?: string | null;
  /** Optional actor overrides (e.g. at login time before the request context is enriched). */
  actorId?: string;
  actorName?: string;
  actorType?: 'PLATFORM' | 'TENANT' | 'SYSTEM';
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget audit record. Never throws into the business flow. */
  async log(entry: AuditEntry): Promise<void> {
    const c = ctx();
    try {
      await this.prisma.platform.auditLog.create({
        data: {
          tenantId: entry.tenantId === undefined ? (c.tenantId ?? null) : entry.tenantId,
          actorId: entry.actorId ?? c.userId ?? null,
          actorType: entry.actorType ?? c.actorType ?? 'SYSTEM',
          actorName: entry.actorName ?? (c.isSupportSession ? `[SUPPORT] ${c.actorName}` : (c.actorName ?? 'system')),
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          before: entry.before === undefined ? undefined : toJson(entry.before),
          after: entry.after === undefined ? undefined : toJson(entry.after),
          reason: entry.reason ?? null,
          ip: c.ip ?? null,
          userAgent: c.userAgent?.slice(0, 300) ?? null,
        },
      });
    } catch (e) {
      this.logger.error(`Audit write failed: ${(e as Error).message}`);
    }
  }

  /** Tenant-scoped audit query (RLS restricts to the caller's school). */
  async list(query: {
    page?: number;
    pageSize?: number;
    entity?: string;
    action?: string;
    actorId?: string;
    from?: string;
    to?: string;
  }) {
    const { skip, take, page, pageSize } = paginate(query.page, query.pageSize);
    const where: any = {};
    if (query.entity) where.entity = query.entity;
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };
    if (query.actorId) where.actorId = query.actorId;
    if (query.from || query.to)
      where.createdAt = {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      };
    const [items, total] = await Promise.all([
      this.prisma.db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.db.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}
