import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StudentsService } from '../students/students.service';
import { ctx, hasPermission, tid } from '../common/context/request-context';
import { money, toJson } from '../common/utils';
import { AssignmentDto, GradeDto, SubmitDto } from './dto';

/**
 * Homework & assignments.
 * Teachers publish assignments per class/subject with a due date; a submission record is created for
 * every active student so completion can be tracked (pending → submitted / late → graded / missing).
 * Parents and students see assignments in the portal; students can mark work as submitted.
 */
@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly students: StudentsService,
  ) {}

  private readonly include = {
    class: { select: { id: true, name: true } },
    subject: { select: { id: true, name: true, code: true } },
    _count: { select: { submissions: true } },
  } as const;

  private async withStats(rows: any[]) {
    if (!rows.length) return [];
    const stats = await this.prisma.db.assignmentSubmission.groupBy({
      by: ['assignmentId', 'status'],
      where: { assignmentId: { in: rows.map((r) => r.id) } },
      _count: { _all: true },
    });
    return rows.map((r) => {
      const mine = stats.filter((s) => s.assignmentId === r.id);
      const byStatus = Object.fromEntries(mine.map((s) => [s.status, s._count._all]));
      const total = mine.reduce((a, s) => a + s._count._all, 0);
      const done = (byStatus.SUBMITTED ?? 0) + (byStatus.LATE ?? 0) + (byStatus.GRADED ?? 0);
      return { ...r, total, byStatus, completion: total ? Math.round((done / total) * 100) : 0, _count: undefined };
    });
  }

  async list(q: { classId?: string; subjectId?: string; status?: string; termOnly?: boolean }) {
    const where: any = {};
    if (q.classId) where.classId = q.classId;
    if (q.subjectId) where.subjectId = q.subjectId;
    if (q.status) where.status = q.status;
    const c = ctx();
    if (c.userType === 'TEACHER' && !hasPermission(c.permissions, 'ACADEMIC_MANAGE') && c.staffId) {
      where.OR = [{ teacherId: c.staffId }, { createdById: c.userId }, { class: { classTeacherId: c.staffId } }];
    }
    const rows = await this.prisma.db.assignment.findMany({
      where,
      orderBy: { dueAt: 'desc' },
      take: 200,
      include: this.include,
    });
    return this.withStats(rows);
  }

  async get(id: string) {
    const a = await this.prisma.db.assignment.findUnique({
      where: { id },
      include: {
        ...this.include,
        submissions: {
          include: {
            student: { select: { id: true, studentId: true, firstName: true, lastName: true, photoUrl: true } },
          },
          orderBy: { student: { lastName: 'asc' } },
        },
      },
    });
    if (!a) throw new NotFoundException('Assignment not found');
    const [withStats] = await this.withStats([{ ...a, submissions: undefined }]);
    return { ...withStats, submissions: a.submissions };
  }

  async create(dto: AssignmentDto) {
    await this.students.assertClassAccess(dto.classId);
    const cs = await this.prisma.db.classSubject.findUnique({
      where: { classId_subjectId: { classId: dto.classId, subjectId: dto.subjectId } },
    });
    if (!cs) throw new BadRequestException('This subject is not assigned to the class');
    const dueAt = new Date(dto.dueAt);
    const status = dto.status ?? 'PUBLISHED';

    const a = await this.prisma.tenantTx(async (tx) => {
      const created = await tx.assignment.create({
        data: {
          tenantId: tid(),
          classId: dto.classId,
          subjectId: dto.subjectId,
          teacherId: ctx().staffId ?? cs.teacherId,
          title: dto.title.trim(),
          instructions: dto.instructions,
          dueAt,
          maxScore: dto.maxScore !== undefined ? money(dto.maxScore) : null,
          status,
          attachments: dto.attachments ? toJson(dto.attachments) : undefined,
          createdById: ctx().userId,
        },
      });
      if (status === 'PUBLISHED') await this.createSubmissionRows(tx, created.id, dto.classId);
      return created;
    });

    if (status === 'PUBLISHED')
      await this.notifyClass(
        dto.classId,
        `New assignment: ${a.title}`,
        `Due ${dueAt.toDateString()}. Open the portal for instructions.`,
        { assignmentId: a.id },
      );
    await this.audit.log({
      action: 'ASSIGNMENT_CREATED',
      entity: 'Assignment',
      entityId: a.id,
      after: { title: a.title, classId: a.classId, dueAt },
    });
    return this.get(a.id);
  }

  private async createSubmissionRows(tx: any, assignmentId: string, classId: string) {
    const students = await tx.student.findMany({ where: { classId, status: 'ACTIVE' }, select: { id: true } });
    if (students.length) {
      await tx.assignmentSubmission.createMany({
        data: students.map((s: any) => ({ tenantId: tid(), assignmentId, studentId: s.id })),
        skipDuplicates: true,
      });
    }
  }

  private async notifyClass(classId: string, title: string, body: string, data: any) {
    const links = await this.prisma.db.studentGuardian.findMany({
      where: { student: { classId, status: 'ACTIVE' } },
      include: { guardian: { select: { userId: true } }, student: { select: { userId: true } } },
    });
    const ids = [...new Set(links.flatMap((l) => [l.guardian.userId, l.student.userId]).filter(Boolean))];
    if (ids.length)
      await this.prisma.db.notification.createMany({
        data: ids.map((userId) => ({ tenantId: tid(), userId, title, body, type: 'ASSIGNMENT', data })),
      });
  }

  async update(id: string, dto: Partial<AssignmentDto>) {
    const before = await this.prisma.db.assignment.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Assignment not found');
    await this.students.assertClassAccess(before.classId);
    const publishing = dto.status === 'PUBLISHED' && before.status === 'DRAFT';
    const a = await this.prisma.tenantTx(async (tx) => {
      const updated = await tx.assignment.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          instructions: dto.instructions,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
          maxScore: dto.maxScore !== undefined ? money(dto.maxScore) : undefined,
          status: dto.status,
          attachments: dto.attachments ? toJson(dto.attachments) : undefined,
        },
      });
      if (publishing) await this.createSubmissionRows(tx, id, before.classId);
      return updated;
    });
    if (publishing)
      await this.notifyClass(before.classId, `New assignment: ${a.title}`, `Due ${a.dueAt.toDateString()}.`, {
        assignmentId: id,
      });
    await this.audit.log({
      action: 'ASSIGNMENT_UPDATED',
      entity: 'Assignment',
      entityId: id,
      before: { status: before.status, dueAt: before.dueAt },
      after: dto,
    });
    return this.get(id);
  }

  async remove(id: string) {
    const before = await this.prisma.db.assignment.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Assignment not found');
    await this.students.assertClassAccess(before.classId);
    await this.prisma.db.assignment.delete({ where: { id } });
    await this.audit.log({
      action: 'ASSIGNMENT_DELETED',
      entity: 'Assignment',
      entityId: id,
      before: { title: before.title },
    });
    return { ok: true };
  }

  /** Teacher grading sheet: status + score + feedback per student. */
  async grade(id: string, dto: GradeDto) {
    const a = await this.prisma.db.assignment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Assignment not found');
    await this.students.assertClassAccess(a.classId);
    const max = a.maxScore ? Number(a.maxScore) : null;
    let graded = 0;
    await this.prisma.tenantTx(async (tx) => {
      for (const item of dto.items) {
        if (item.score !== null && item.score !== undefined && max !== null && item.score > max)
          throw new BadRequestException(`Score for ${item.studentId} exceeds the maximum of ${max}`);
        const hasScore = item.score !== null && item.score !== undefined;
        await tx.assignmentSubmission.upsert({
          where: { assignmentId_studentId: { assignmentId: id, studentId: item.studentId } },
          create: {
            tenantId: tid(),
            assignmentId: id,
            studentId: item.studentId,
            status: (item.status as any) ?? (hasScore ? 'GRADED' : 'PENDING'),
            score: hasScore ? money(item.score) : null,
            feedback: item.feedback,
            gradedById: hasScore ? ctx().userId : null,
            gradedAt: hasScore ? new Date() : null,
          },
          update: {
            status: (item.status as any) ?? (hasScore ? 'GRADED' : undefined),
            score: hasScore ? money(item.score) : item.score === null ? null : undefined,
            feedback: item.feedback,
            gradedById: hasScore ? ctx().userId : undefined,
            gradedAt: hasScore ? new Date() : undefined,
          },
        });
        graded++;
      }
    });
    await this.audit.log({ action: 'ASSIGNMENT_GRADED', entity: 'Assignment', entityId: id, after: { items: graded } });
    return this.get(id);
  }

  /** Portal: assignments for a student (parent/student view). */
  async forStudent(studentId: string) {
    const rows = await this.prisma.db.assignmentSubmission.findMany({
      where: { studentId, assignment: { status: { not: 'DRAFT' } } },
      include: { assignment: { include: { subject: { select: { name: true } }, class: { select: { name: true } } } } },
      orderBy: { assignment: { dueAt: 'desc' } },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      assignmentId: r.assignmentId,
      title: r.assignment.title,
      subject: r.assignment.subject.name,
      instructions: r.assignment.instructions,
      attachments: r.assignment.attachments,
      dueAt: r.assignment.dueAt,
      maxScore: r.assignment.maxScore,
      status: r.status,
      submittedAt: r.submittedAt,
      score: r.score,
      feedback: r.feedback,
      overdue: r.status === 'PENDING' && r.assignment.dueAt < new Date(),
    }));
  }

  /** Student (or parent on behalf) marks an assignment as submitted. */
  async submit(assignmentId: string, studentId: string, dto: SubmitDto) {
    const a = await this.prisma.db.assignment.findUnique({ where: { id: assignmentId } });
    if (!a) throw new NotFoundException('Assignment not found');
    if (a.status !== 'PUBLISHED') throw new ForbiddenException('This assignment is closed');
    const late = new Date() > a.dueAt;
    const s = await this.prisma.db.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      create: {
        tenantId: tid(),
        assignmentId,
        studentId,
        status: late ? 'LATE' : 'SUBMITTED',
        submittedAt: new Date(),
        feedback: undefined,
      },
      update: { status: late ? 'LATE' : 'SUBMITTED', submittedAt: new Date() },
    });
    if (dto.note || dto.attachments) {
      await this.prisma.db.assignmentSubmission.update({ where: { id: s.id }, data: { feedback: undefined } });
    }
    return s;
  }

  /** Teacher dashboard widget: assignments due soon and grading backlog. */
  async teacherSummary() {
    const c = ctx();
    if (!c.staffId) return { dueSoon: [], toGrade: 0 };
    const rows = await this.prisma.db.assignment.findMany({
      where: { status: 'PUBLISHED', OR: [{ teacherId: c.staffId }, { createdById: c.userId }] },
      include: this.include,
      orderBy: { dueAt: 'asc' },
      take: 20,
    });
    const withStats = await this.withStats(rows);
    const toGrade = withStats.reduce((n, a) => n + (a.byStatus.SUBMITTED ?? 0) + (a.byStatus.LATE ?? 0), 0);
    return { dueSoon: withStats.slice(0, 6), toGrade };
  }
}
