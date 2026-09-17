import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ctx, tid } from '../common/context/request-context';
import { PeriodDto, SlotDto } from './dto';

const SLOT_INCLUDE = {
  subject: { select: { id: true, name: true, code: true } },
  teacher: { select: { id: true, firstName: true, lastName: true } },
  room: { select: { id: true, name: true } },
  period: true,
  class: { select: { id: true, name: true } },
} as const;

@Injectable()
export class TimetableService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  periods() {
    return this.prisma.db.period.findMany({ orderBy: { sequence: 'asc' } });
  }
  async createPeriod(dto: PeriodDto) {
    if (dto.startTime >= dto.endTime) throw new BadRequestException('Start time must be before end time');
    return this.prisma.db.period.create({ data: { tenantId: tid(), ...dto, isBreak: !!dto.isBreak } });
  }
  updatePeriod(id: string, dto: Partial<PeriodDto>) {
    return this.prisma.db.period.update({ where: { id }, data: { ...dto } });
  }
  async deletePeriod(id: string) {
    await this.prisma.db.period.delete({ where: { id } });
    return { ok: true };
  }

  /** Detects teacher / room / class double-booking before a slot is written. */
  private async checkConflicts(dto: SlotDto, excludeId?: string) {
    const db = this.prisma.db;
    const base: any = { dayOfWeek: dto.dayOfWeek, periodId: dto.periodId };
    if (excludeId) base.id = { not: excludeId };
    const conflicts: Array<{ type: string; message: string; slotId: string }> = [];
    const classClash = await db.timetableSlot.findFirst({
      where: { ...base, classId: dto.classId },
      include: SLOT_INCLUDE,
    });
    if (classClash)
      conflicts.push({
        type: 'CLASS',
        message: `${classClash.class.name} already has ${classClash.subject.name} in this period`,
        slotId: classClash.id,
      });
    if (dto.teacherId) {
      const t = await db.timetableSlot.findFirst({
        where: { ...base, teacherId: dto.teacherId },
        include: SLOT_INCLUDE,
      });
      if (t)
        conflicts.push({
          type: 'TEACHER',
          message: `${t.teacher.firstName} ${t.teacher.lastName} is already teaching ${t.subject.name} to ${t.class.name} in this period`,
          slotId: t.id,
        });
    }
    if (dto.roomId) {
      const r = await db.timetableSlot.findFirst({ where: { ...base, roomId: dto.roomId }, include: SLOT_INCLUDE });
      if (r)
        conflicts.push({
          type: 'ROOM',
          message: `${r.room.name} is already used by ${r.class.name} (${r.subject.name}) in this period`,
          slotId: r.id,
        });
    }
    return conflicts;
  }

  async createSlot(dto: SlotDto) {
    const cs = await this.prisma.db.classSubject.findUnique({
      where: { classId_subjectId: { classId: dto.classId, subjectId: dto.subjectId } },
    });
    if (!cs) throw new BadRequestException('This subject is not assigned to the class');
    const teacherId = dto.teacherId === undefined ? cs.teacherId : dto.teacherId || null;
    const conflicts = await this.checkConflicts({ ...dto, teacherId });
    if (conflicts.length)
      throw new ConflictException({ code: 'TIMETABLE_CONFLICT', message: conflicts[0].message, conflicts });
    const slot = await this.prisma.db.timetableSlot.create({
      data: {
        tenantId: tid(),
        classId: dto.classId,
        subjectId: dto.subjectId,
        teacherId,
        roomId: dto.roomId || null,
        dayOfWeek: dto.dayOfWeek,
        periodId: dto.periodId,
      },
      include: SLOT_INCLUDE,
    });
    await this.audit.log({ action: 'TIMETABLE_SLOT_CREATED', entity: 'TimetableSlot', entityId: slot.id, after: dto });
    return slot;
  }

  async updateSlot(id: string, dto: Partial<SlotDto>) {
    const cur = await this.prisma.db.timetableSlot.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException('Slot not found');
    const merged: SlotDto = {
      classId: dto.classId ?? cur.classId,
      subjectId: dto.subjectId ?? cur.subjectId,
      teacherId: dto.teacherId === undefined ? cur.teacherId : dto.teacherId,
      roomId: dto.roomId === undefined ? cur.roomId : dto.roomId,
      dayOfWeek: dto.dayOfWeek ?? cur.dayOfWeek,
      periodId: dto.periodId ?? cur.periodId,
    };
    const conflicts = await this.checkConflicts(merged, id);
    if (conflicts.length)
      throw new ConflictException({ code: 'TIMETABLE_CONFLICT', message: conflicts[0].message, conflicts });
    return this.prisma.db.timetableSlot.update({
      where: { id },
      data: { ...merged, teacherId: merged.teacherId || null, roomId: merged.roomId || null },
      include: SLOT_INCLUDE,
    });
  }

  async deleteSlot(id: string) {
    await this.prisma.db.timetableSlot.delete({ where: { id } });
    await this.audit.log({ action: 'TIMETABLE_SLOT_DELETED', entity: 'TimetableSlot', entityId: id });
    return { ok: true };
  }

  forClass(classId: string) {
    return this.prisma.db.timetableSlot.findMany({
      where: { classId },
      include: SLOT_INCLUDE,
      orderBy: [{ dayOfWeek: 'asc' }, { period: { sequence: 'asc' } }],
    });
  }
  forTeacher(teacherId: string) {
    return this.prisma.db.timetableSlot.findMany({
      where: { teacherId },
      include: SLOT_INCLUDE,
      orderBy: [{ dayOfWeek: 'asc' }, { period: { sequence: 'asc' } }],
    });
  }
  forRoom(roomId: string) {
    return this.prisma.db.timetableSlot.findMany({
      where: { roomId },
      include: SLOT_INCLUDE,
      orderBy: [{ dayOfWeek: 'asc' }, { period: { sequence: 'asc' } }],
    });
  }
  mine() {
    const c = ctx();
    if (!c.staffId) return [];
    return this.forTeacher(c.staffId);
  }

  /** Full scan for existing conflicts (e.g. after teacher reassignments). */
  async conflicts() {
    const slots = await this.prisma.db.timetableSlot.findMany({ include: SLOT_INCLUDE });
    const out: any[] = [];
    const groups = (key: (s: any) => string | null, type: string) => {
      const map = new Map<string, any[]>();
      for (const s of slots) {
        const k = key(s);
        if (!k) continue;
        const g = `${k}|${s.dayOfWeek}|${s.periodId}`;
        map.set(g, [...(map.get(g) ?? []), s]);
      }
      for (const [, list] of map)
        if (list.length > 1)
          out.push({
            type,
            dayOfWeek: list[0].dayOfWeek,
            period: list[0].period.name,
            slots: list.map((s) => ({
              id: s.id,
              class: s.class.name,
              subject: s.subject.name,
              teacher: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : null,
              room: s.room?.name ?? null,
            })),
          });
    };
    groups((s) => s.teacherId, 'TEACHER');
    groups((s) => s.roomId, 'ROOM');
    return out;
  }
}
