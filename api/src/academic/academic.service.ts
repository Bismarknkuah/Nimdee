import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GES_SUBJECTS, LEVEL_GROUPS, LEVEL_LABELS, LevelGroup, RESIDENCY_LABELS, RESIDENCY_OPTIONS, STANDARD_CLASSES, standardClassFor } from '../common/ghana-basic';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { tid } from '../common/context/request-context';
import { ClassDto, RoomDto, SetClassSubjectsDto, SubjectDto, TermDto, YearDto } from './dto';

@Injectable()
export class AcademicService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private tenants: TenantCacheService,
  ) {}

  /** Current academic year + term (falls back to the latest by date). */
  async current() {
    const db = this.prisma.db;
    const year =
      (await db.academicYear.findFirst({
        where: { isCurrent: true },
        include: { terms: { orderBy: { sequence: 'asc' } } },
      })) ??
      (await db.academicYear.findFirst({
        orderBy: { startDate: 'desc' },
        include: { terms: { orderBy: { sequence: 'asc' } } },
      }));
    if (!year) return { year: null, term: null };
    const term =
      year.terms.find((t) => t.isCurrent) ??
      year.terms.find((t) => t.startDate <= new Date() && t.endDate >= new Date()) ??
      year.terms[0] ??
      null;
    return { year: { ...year, terms: undefined }, term, terms: year.terms };
  }

  // ── Years ──
  years() {
    return this.prisma.db.academicYear.findMany({
      orderBy: { startDate: 'desc' },
      include: { terms: { orderBy: { sequence: 'asc' } } },
    });
  }
  async createYear(dto: YearDto) {
    if (new Date(dto.startDate) >= new Date(dto.endDate))
      throw new BadRequestException('Start date must be before end date');
    return this.prisma.tenantTx(async (tx) => {
      if (dto.isCurrent) await tx.academicYear.updateMany({ where: { tenantId: tid() }, data: { isCurrent: false } });
      const y = await tx.academicYear.create({
        data: {
          tenantId: tid(),
          name: dto.name.trim(),
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          isCurrent: !!dto.isCurrent,
        },
      });
      await this.audit.log({ action: 'ACADEMIC_YEAR_CREATED', entity: 'AcademicYear', entityId: y.id, after: dto });
      return y;
    });
  }
  async updateYear(id: string, dto: Partial<YearDto>) {
    return this.prisma.tenantTx(async (tx) => {
      if (dto.isCurrent) await tx.academicYear.updateMany({ where: { tenantId: tid() }, data: { isCurrent: false } });
      return tx.academicYear.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          isCurrent: dto.isCurrent,
        },
      });
    });
  }

  // ── Terms ──
  terms(academicYearId?: string) {
    return this.prisma.db.term.findMany({
      where: academicYearId ? { academicYearId } : undefined,
      orderBy: [{ academicYear: { startDate: 'desc' } }, { sequence: 'asc' }],
      include: { academicYear: { select: { id: true, name: true } } },
    });
  }
  async createTerm(dto: TermDto) {
    const year = await this.prisma.db.academicYear.findUnique({ where: { id: dto.academicYearId } });
    if (!year) throw new NotFoundException('Academic year not found');
    const count = await this.prisma.db.term.count({ where: { academicYearId: dto.academicYearId } });
    return this.prisma.tenantTx(async (tx) => {
      if (dto.isCurrent) await tx.term.updateMany({ where: { tenantId: tid() }, data: { isCurrent: false } });
      return tx.term.create({
        data: {
          tenantId: tid(),
          academicYearId: dto.academicYearId,
          name: dto.name.trim(),
          sequence: dto.sequence ?? count + 1,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          examStart: dto.examStart ? new Date(dto.examStart) : null,
          examEnd: dto.examEnd ? new Date(dto.examEnd) : null,
          isCurrent: !!dto.isCurrent,
        },
      });
    });
  }
  async updateTerm(id: string, dto: Partial<TermDto>) {
    return this.prisma.tenantTx(async (tx) => {
      if (dto.isCurrent) {
        const term = await tx.term.findUnique({ where: { id } });
        if (!term) throw new NotFoundException('Term not found');
        await tx.term.updateMany({ where: { tenantId: tid() }, data: { isCurrent: false } });
        await tx.academicYear.updateMany({ where: { tenantId: tid() }, data: { isCurrent: false } });
        await tx.academicYear.update({ where: { id: term.academicYearId }, data: { isCurrent: true } });
      }
      return tx.term.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          sequence: dto.sequence,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          examStart: dto.examStart ? new Date(dto.examStart) : undefined,
          examEnd: dto.examEnd ? new Date(dto.examEnd) : undefined,
          isCurrent: dto.isCurrent,
        },
      });
    });
  }

  // ── Classes ──
  async classes() {
    const rows = await this.prisma.db.schoolClass.findMany({
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      include: {
        classTeacher: { select: { id: true, firstName: true, lastName: true } },
        nextClass: { select: { id: true, name: true } },
        _count: { select: { students: { where: { status: 'ACTIVE' } }, subjects: true } },
      },
    });
    return rows.map((c) => ({
      ...c,
      studentCount: c._count.students,
      subjectCount: c._count.subjects,
      _count: undefined,
    }));
  }
  async getClass(id: string) {
    const c = await this.prisma.db.schoolClass.findUnique({
      where: { id },
      include: {
        classTeacher: { select: { id: true, firstName: true, lastName: true } },
        subjects: { include: { subject: true, teacher: { select: { id: true, firstName: true, lastName: true } } } },
        students: {
          where: { status: 'ACTIVE' },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          select: { id: true, studentId: true, firstName: true, lastName: true, gender: true, photoUrl: true },
        },
      },
    });
    if (!c) throw new NotFoundException('Class not found');
    return c;
  }
  async createClass(dto: ClassDto) {
    const c = await this.prisma.db.schoolClass.create({
      data: {
        tenantId: tid(),
        name: dto.name.trim(),
        level: dto.level.trim().toUpperCase(),
        stream: dto.stream,
        capacity: dto.capacity,
        classTeacherId: dto.classTeacherId || null,
        nextClassId: dto.nextClassId || null,
        isFinal: !!dto.isFinal,
      },
    });
    await this.audit.log({ action: 'CLASS_CREATED', entity: 'SchoolClass', entityId: c.id, after: dto });
    return c;
  }
  async updateClass(id: string, dto: Partial<ClassDto>) {
    if (dto.nextClassId === id) throw new BadRequestException('A class cannot promote into itself');
    const c = await this.prisma.db.schoolClass.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        level: dto.level?.trim().toUpperCase(),
        stream: dto.stream,
        capacity: dto.capacity,
        classTeacherId: dto.classTeacherId === undefined ? undefined : dto.classTeacherId || null,
        nextClassId: dto.nextClassId === undefined ? undefined : dto.nextClassId || null,
        isFinal: dto.isFinal,
      },
    });
    await this.audit.log({ action: 'CLASS_UPDATED', entity: 'SchoolClass', entityId: id, after: dto });
    return c;
  }
  async deleteClass(id: string) {
    const students = await this.prisma.db.student.count({ where: { classId: id } });
    if (students) throw new BadRequestException(`Class still has ${students} student(s). Move them first.`);
    await this.prisma.db.schoolClass.delete({ where: { id } });
    await this.audit.log({ action: 'CLASS_DELETED', entity: 'SchoolClass', entityId: id });
    return { ok: true };
  }
  async setClassSubjects(classId: string, dto: SetClassSubjectsDto) {
    const cls = await this.prisma.db.schoolClass.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');
    await this.prisma.tenantTx(async (tx) => {
      const keep = dto.subjects.map((s) => s.subjectId);
      await tx.classSubject.deleteMany({ where: { classId, subjectId: { notIn: keep } } });
      for (const s of dto.subjects) {
        await tx.classSubject.upsert({
          where: { classId_subjectId: { classId, subjectId: s.subjectId } },
          create: { tenantId: tid(), classId, subjectId: s.subjectId, teacherId: s.teacherId || null },
          update: { teacherId: s.teacherId || null },
        });
      }
    });
    await this.audit.log({ action: 'CLASS_SUBJECTS_SET', entity: 'SchoolClass', entityId: classId, after: dto });
    return this.getClass(classId);
  }

  // ── Subjects ──
  subjects() {
    return this.prisma.db.subject.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { classes: true } } },
    });
  }
  createSubject(dto: SubjectDto) {
    return this.prisma.db.subject.create({
      data: { tenantId: tid(), name: dto.name.trim(), code: dto.code.trim().toUpperCase(), isCore: dto.isCore ?? true },
    });
  }
  updateSubject(id: string, dto: Partial<SubjectDto>) {
    return this.prisma.db.subject.update({
      where: { id },
      data: { name: dto.name?.trim(), code: dto.code?.trim().toUpperCase(), isCore: dto.isCore },
    });
  }
  async deleteSubject(id: string) {
    await this.prisma.db.subject.delete({ where: { id } });
    return { ok: true };
  }

  // ── Rooms ──
  rooms() {
    return this.prisma.db.room.findMany({ orderBy: { name: 'asc' } });
  }
  createRoom(dto: RoomDto) {
    return this.prisma.db.room.create({ data: { tenantId: tid(), name: dto.name.trim(), capacity: dto.capacity } });
  }
  async deleteRoom(id: string) {
    await this.prisma.db.room.delete({ where: { id } });
    return { ok: true };
  }

  // ─────────────────────────── Ghana basic-school presets ───────────────────────────
  /** Catalogue for the UI: standard classes, GES subjects, residency options and what the school has configured. */
  async ghanaBasicCatalogue() {
    const settings = await this.tenants.settings(tid());
    const classes = await this.prisma.db.schoolClass.findMany({ select: { id: true, name: true, level: true, nextClassId: true } });
    const existing = new Map(classes.map((c) => [standardClassFor(c.name)?.name ?? c.name, c]));
    return {
      levels: LEVEL_GROUPS.map((l) => ({ code: l, label: LEVEL_LABELS[l], enabled: settings.school.levels.includes(l) })),
      residency: { value: settings.school.residency, options: RESIDENCY_OPTIONS.map((r) => ({ code: r, label: RESIDENCY_LABELS[r] })) },
      classes: STANDARD_CLASSES.map((c) => ({ ...c, exists: existing.has(c.name), classId: existing.get(c.name)?.id ?? null, inScope: settings.school.levels.includes(c.level) })),
      subjects: GES_SUBJECTS,
    };
  }

  /**
   * Creates the standard classes and GES subjects for the levels the school runs, links the promotion
   * path (KG 1 → KG 2 → Basic 1 … → JHS 3) and attaches the level's subjects to each class.
   * Safe to run repeatedly: existing classes (by name or alias) and subjects (by code) are reused.
   */
  async ghanaBasicSetup(opts: { levels?: LevelGroup[]; attachSubjects?: boolean } = {}) {
    const settings = await this.tenants.settings(tid());
    const levels = (opts.levels?.length ? opts.levels : settings.school.levels) as LevelGroup[];
    const tenantId = tid();
    const result = await this.prisma.tenantTx(async (tx) => {
      const subjectByCode = new Map<string, string>();
      for (const s of await tx.subject.findMany({ select: { id: true, code: true } })) subjectByCode.set(s.code.toUpperCase(), s.id);
      let subjectsCreated = 0;
      for (const level of levels) {
        for (const preset of GES_SUBJECTS[level]) {
          if (subjectByCode.has(preset.code)) continue;
          const created = await tx.subject.create({ data: { tenantId, name: preset.name, code: preset.code, isCore: preset.isCore } });
          subjectByCode.set(preset.code, created.id);
          subjectsCreated++;
        }
      }
      const existing = await tx.schoolClass.findMany({ select: { id: true, name: true } });
      const byStd = new Map<string, string>();
      for (const c of existing) {
        const std = standardClassFor(c.name);
        if (std) byStd.set(std.name, c.id);
      }
      let classesCreated = 0;
      const wanted = STANDARD_CLASSES.filter((c) => levels.includes(c.level));
      for (const std of wanted) {
        if (byStd.has(std.name)) continue;
        const created = await tx.schoolClass.create({ data: { tenantId, name: std.name, level: std.level, capacity: 40 } });
        byStd.set(std.name, created.id);
        classesCreated++;
      }
      // Promotion chain in stage order (only among classes that exist).
      const ordered = STANDARD_CLASSES.filter((c) => byStd.has(c.name)).sort((a, b) => a.stage - b.stage);
      for (let i = 0; i < ordered.length; i++) {
        const next = ordered[i + 1];
        await tx.schoolClass.update({ where: { id: byStd.get(ordered[i].name)! }, data: { nextClassId: next ? byStd.get(next.name)! : null } });
      }
      let linksCreated = 0;
      if (opts.attachSubjects !== false) {
        for (const std of wanted) {
          const classId = byStd.get(std.name)!;
          for (const preset of GES_SUBJECTS[std.level]) {
            const subjectId = subjectByCode.get(preset.code)!;
            const link = await tx.classSubject.findUnique({ where: { classId_subjectId: { classId, subjectId } } });
            if (!link) {
              await tx.classSubject.create({ data: { tenantId, classId, subjectId } });
              linksCreated++;
            }
          }
        }
      }
      return { levels, classesCreated, subjectsCreated, linksCreated, classes: ordered.map((c) => ({ name: c.name, level: c.level, id: byStd.get(c.name) })) };
    });
    await this.audit.log({ action: 'GHANA_BASIC_SETUP', entity: 'Tenant', entityId: tenantId, after: { levels, classesCreated: result.classesCreated, subjectsCreated: result.subjectsCreated } });
    return result;
  }

}
