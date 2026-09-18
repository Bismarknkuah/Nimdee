import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { ctx, tid } from '../common/context/request-context';
import { AnnouncementDto } from './dto';
import { ProvidersService } from './providers.service';

@Injectable()
export class CommunicationsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private tenants: TenantCacheService,
    private providers: ProvidersService,
  ) {}

  list() {
    return this.prisma.db.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async create(dto: AnnouncementDto) {
    if (dto.audienceType === 'CLASS' && !dto.classId)
      throw new BadRequestException('Select a class for class announcements');
    const a = await this.prisma.db.announcement.create({
      data: {
        tenantId: tid(),
        title: dto.title.trim(),
        body: dto.body,
        audienceType: dto.audienceType ?? 'ALL',
        classId: dto.classId ?? null,
        channels: dto.channels?.length ? dto.channels : ['IN_APP'],
        isPublic: !!dto.isPublic,
        createdById: ctx().userId,
      },
    });
    await this.audit.log({
      action: 'ANNOUNCEMENT_CREATED',
      entity: 'Announcement',
      entityId: a.id,
      after: { title: a.title, audience: a.audienceType },
    });
    return dto.publish ? this.publish(a.id) : a;
  }

  async update(id: string, dto: Partial<AnnouncementDto>) {
    const a = await this.prisma.db.announcement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Announcement not found');
    if (a.publishedAt) throw new BadRequestException('Published announcements cannot be edited');
    return this.prisma.db.announcement.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        body: dto.body,
        audienceType: dto.audienceType,
        classId: dto.classId,
        channels: dto.channels,
        isPublic: dto.isPublic,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.db.announcement.delete({ where: { id } });
    await this.audit.log({ action: 'ANNOUNCEMENT_DELETED', entity: 'Announcement', entityId: id });
    return { ok: true };
  }

  /** Resolves the audience → in-app notifications + SMS/email according to the selected channels. */
  async publish(id: string) {
    const db = this.prisma.db;
    const a = await db.announcement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Announcement not found');
    if (a.publishedAt) return a;
    const users: Array<{ id: string; phone: string | null; email: string }> = [];
    const phones: string[] = [];
    const emails: string[] = [];
    const push = (u: { id: string; phone: string | null; email: string }) => {
      users.push(u);
      if (u.phone) phones.push(u.phone);
      if (u.email && !u.email.endsWith('.student')) emails.push(u.email);
    };
    if (a.audienceType === 'CLASS') {
      const links = await db.studentGuardian.findMany({
        where: { student: { classId: a.classId, status: 'ACTIVE' } },
        include: { guardian: { include: { user: { select: { id: true, phone: true, email: true } } } } },
      });
      for (const l of links) {
        if (l.guardian.user) push(l.guardian.user);
        else if (l.guardian.phone) phones.push(l.guardian.phone);
        if (l.guardian.email) emails.push(l.guardian.email);
      }
    } else {
      const typeMap: Record<string, any> = {
        ALL: undefined,
        PARENTS: { in: ['PARENT'] },
        TEACHERS: { in: ['TEACHER'] },
        STAFF: { in: ['STAFF', 'TEACHER'] },
        STUDENTS: { in: ['STUDENT'] },
      };
      const rows = await db.user.findMany({
        where: { isActive: true, userType: typeMap[a.audienceType] },
        select: { id: true, phone: true, email: true },
      });
      rows.forEach(push);
      if (a.audienceType === 'PARENTS' || a.audienceType === 'ALL') {
        const gs = await db.guardian.findMany({ where: { userId: null }, select: { phone: true, email: true } });
        for (const g of gs) {
          if (g.phone) phones.push(g.phone);
          if (g.email) emails.push(g.email);
        }
      }
    }
    const uniqueUsers = [...new Map(users.map((u) => [u.id, u])).values()];
    if (uniqueUsers.length)
      await db.notification.createMany({
        data: uniqueUsers.map((u) => ({
          tenantId: tid(),
          userId: u.id,
          title: a.title,
          body: a.body.slice(0, 500),
          type: 'ANNOUNCEMENT',
          data: { announcementId: a.id },
        })),
      });
    const snap = await this.tenants.get(tid());
    const delivery: any = { inApp: uniqueUsers.length };
    if (a.channels.includes('SMS'))
      delivery.sms = await this.providers.sendSms(
        phones,
        `${snap.name}: ${a.title}. ${a.body}`.slice(0, 480),
        snap.settings.communication.smsSenderId,
      );
    if (a.channels.includes('EMAIL'))
      delivery.email = await this.providers.sendEmail(emails, `${snap.name}: ${a.title}`, a.body);
    const updated = await db.announcement.update({
      where: { id },
      data: {
        publishedAt: new Date(),
        recipients: uniqueUsers.length + (a.channels.includes('SMS') ? phones.length : 0),
      },
    });
    await this.audit.log({ action: 'ANNOUNCEMENT_PUBLISHED', entity: 'Announcement', entityId: id, after: delivery });
    return { ...updated, delivery };
  }

  // ── Notifications (any signed-in user) ──
  async myNotifications() {
    const [items, unread] = await Promise.all([
      this.prisma.db.notification.findMany({
        where: { userId: ctx().userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.db.notification.count({ where: { userId: ctx().userId, readAt: null } }),
    ]);
    return { items, unread };
  }
  async markRead(id?: string) {
    await this.prisma.db.notification.updateMany({
      where: { userId: ctx().userId, readAt: null, ...(id ? { id } : {}) },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
