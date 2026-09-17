import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ctx, tid } from '../common/context/request-context';
import { addDays, startOfToday } from '../common/utils';
import { EventDto, ListEventsDto } from './dto';

/**
 * School calendar: holidays, exams, meetings, sports days, trips.
 * Events are scoped by audience (everyone / parents / staff / a single class) and can optionally be
 * shown on the public website. The term calendar is generated from academic years/terms plus events.
 */
@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListEventsDto, opts: { forUserAudience?: boolean } = {}) {
    const from = q.from ? new Date(q.from) : addDays(startOfToday(), -30);
    const to = q.to ? new Date(q.to) : addDays(startOfToday(), 120);
    const where: any = { startAt: { lte: to }, endAt: { gte: from } };
    if (q.type) where.type = q.type;
    if (q.classId) where.OR = [{ classId: q.classId }, { classId: null }];

    if (opts.forUserAudience) {
      const c = ctx();
      const audiences = ['ALL'];
      if (c.userType === 'PARENT') audiences.push('PARENTS');
      if (c.userType === 'TEACHER') audiences.push('TEACHERS', 'STAFF');
      if (c.userType === 'STAFF') audiences.push('STAFF');
      if (c.userType === 'STUDENT') audiences.push('STUDENTS');
      where.AND = [
        { OR: [{ audienceType: { in: audiences as any } }, { audienceType: 'CLASS', classId: q.classId ?? '-' }] },
      ];
    }

    const events = await this.prisma.db.schoolEvent.findMany({ where, orderBy: { startAt: 'asc' } });
    const classIds = [...new Set(events.map((e) => e.classId).filter(Boolean))];
    const classes = classIds.length
      ? await this.prisma.db.schoolClass.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } })
      : [];
    return events.map((e) => ({ ...e, className: classes.find((c) => c.id === e.classId)?.name ?? null }));
  }

  /** Month view: events grouped per day, plus term boundaries. */
  async calendar(year: number, month: number) {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    const [events, terms] = await Promise.all([
      this.list({ from: from.toISOString(), to: to.toISOString() }),
      this.prisma.db.term.findMany({
        where: { startDate: { lte: to }, endDate: { gte: from } },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          examStart: true,
          examEnd: true,
          academicYear: { select: { name: true } },
        },
      }),
    ]);
    const days: Record<string, any[]> = {};
    for (const e of events) {
      let d = new Date(Math.max(e.startAt.getTime(), from.getTime()));
      const end = new Date(Math.min(e.endAt.getTime(), to.getTime()));
      while (d <= end) {
        const key = d.toISOString().slice(0, 10);
        (days[key] ??= []).push({
          id: e.id,
          title: e.title,
          type: e.type,
          allDay: e.allDay,
          startAt: e.startAt,
          endAt: e.endAt,
          location: e.location,
        });
        d = addDays(d, 1);
      }
    }
    return { year, month, days, terms };
  }

  async upcoming(limit = 8) {
    const events = await this.prisma.db.schoolEvent.findMany({
      where: { endAt: { gte: new Date() } },
      orderBy: { startAt: 'asc' },
      take: limit,
    });
    return events;
  }

  async get(id: string) {
    const e = await this.prisma.db.schoolEvent.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Event not found');
    return e;
  }

  async create(dto: EventDto) {
    const startAt = new Date(dto.startAt);
    const endAt = dto.endAt
      ? new Date(dto.endAt)
      : dto.allDay
        ? new Date(startAt.getTime() + 86400000 - 1)
        : new Date(startAt.getTime() + 3600000);
    if (endAt < startAt) throw new BadRequestException('End must be after start');
    if (dto.audienceType === 'CLASS' && !dto.classId) throw new BadRequestException('Select a class for class events');

    const e = await this.prisma.db.schoolEvent.create({
      data: {
        tenantId: tid(),
        title: dto.title.trim(),
        description: dto.description,
        type: dto.type ?? 'OTHER',
        startAt,
        endAt,
        allDay: !!dto.allDay,
        location: dto.location,
        audienceType: dto.audienceType ?? 'ALL',
        classId: dto.classId ?? null,
        isPublic: !!dto.isPublic,
        createdById: ctx().userId,
      },
    });
    if (dto.notify) await this.notify(e);
    await this.audit.log({
      action: 'EVENT_CREATED',
      entity: 'SchoolEvent',
      entityId: e.id,
      after: { title: e.title, type: e.type, startAt },
    });
    return e;
  }

  async update(id: string, dto: Partial<EventDto>) {
    const before = await this.get(id);
    const e = await this.prisma.db.schoolEvent.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description,
        type: dto.type,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        allDay: dto.allDay,
        location: dto.location,
        audienceType: dto.audienceType,
        classId: dto.classId === undefined ? undefined : dto.classId || null,
        isPublic: dto.isPublic,
      },
    });
    if (dto.notify) await this.notify(e);
    await this.audit.log({
      action: 'EVENT_UPDATED',
      entity: 'SchoolEvent',
      entityId: id,
      before: { title: before.title, startAt: before.startAt },
      after: dto,
    });
    return e;
  }

  async remove(id: string) {
    const before = await this.get(id);
    await this.prisma.db.schoolEvent.delete({ where: { id } });
    await this.audit.log({ action: 'EVENT_DELETED', entity: 'SchoolEvent', entityId: id, before });
    return { ok: true };
  }

  /** In-app notification to the event audience. */
  private async notify(e: { id: string; title: string; startAt: Date; audienceType: string; classId: string | null }) {
    const db = this.prisma.db;
    let userIds: string[] = [];
    if (e.audienceType === 'CLASS' && e.classId) {
      const links = await db.studentGuardian.findMany({
        where: { student: { classId: e.classId, status: 'ACTIVE' } },
        include: { guardian: { select: { userId: true } }, student: { select: { userId: true } } },
      });
      userIds = links.flatMap((l) => [l.guardian.userId, l.student.userId]).filter(Boolean);
    } else {
      const typeMap: Record<string, any> = {
        ALL: undefined,
        PARENTS: { in: ['PARENT'] },
        TEACHERS: { in: ['TEACHER'] },
        STAFF: { in: ['STAFF', 'TEACHER'] },
        STUDENTS: { in: ['STUDENT'] },
      };
      const users = await db.user.findMany({
        where: { isActive: true, userType: typeMap[e.audienceType] },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    }
    const unique = [...new Set(userIds)];
    if (unique.length) {
      await db.notification.createMany({
        data: unique.map((userId) => ({
          tenantId: tid(),
          userId,
          title: `Event: ${e.title}`,
          body: `${e.title} is scheduled for ${e.startAt.toDateString()}.`,
          type: 'EVENT',
          data: { eventId: e.id },
        })),
      });
    }
  }
}
