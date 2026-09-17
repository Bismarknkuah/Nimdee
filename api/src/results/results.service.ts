import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { StudentsService } from '../students/students.service';
import { PdfService } from '../pdf/pdf.service';
import { ctx, hasPermission, tid } from '../common/context/request-context';
import { GradeBand } from '../common/settings';
import { gradeFor } from './grading';
import { money, toJson } from '../common/utils';
import { AssessmentDto, CommentsDto, ComputeDto, SaveMarksDto, WorkflowDto } from './dto';

type Action = 'submit' | 'review' | 'approve' | 'publish' | 'reject';
const round1 = (n: number) => Math.round(n * 10) / 10;

@Injectable()
export class ResultsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private tenants: TenantCacheService,
    private students: StudentsService,
    private pdf: PdfService,
  ) {}

  private gradeFor(score: number, scheme: GradeBand[]) {
    return gradeFor(score, scheme);
  }

  // ─────────────────────────── Assessments & marks ───────────────────────────
  async assessments(termId: string, classId?: string, subjectId?: string) {
    const c = ctx();
    const where: any = { termId };
    if (classId) where.classId = classId;
    if (subjectId) where.subjectId = subjectId;
    if (c.userType === 'TEACHER' && !hasPermission(c.permissions, 'ACADEMIC_MANAGE') && c.staffId) {
      where.OR = [
        { subject: { classes: { some: { teacherId: c.staffId, classId: classId ?? undefined } } } },
        { createdById: c.userId },
      ];
    }
    const rows = await this.prisma.db.assessment.findMany({
      where,
      orderBy: [{ subject: { name: 'asc' } }, { createdAt: 'asc' }],
      include: { subject: { select: { id: true, name: true, code: true } }, _count: { select: { marks: true } } },
    });
    const classes = await this.prisma.db.schoolClass.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.classId))] } },
      select: { id: true, name: true },
    });
    return rows.map((r) => ({
      ...r,
      className: classes.find((k) => k.id === r.classId)?.name,
      marksEntered: r._count.marks,
      _count: undefined,
    }));
  }

  async createAssessment(dto: AssessmentDto) {
    await this.students.assertClassAccess(dto.classId);
    const cs = await this.prisma.db.classSubject.findUnique({
      where: { classId_subjectId: { classId: dto.classId, subjectId: dto.subjectId } },
    });
    if (!cs) throw new BadRequestException('This subject is not assigned to the class');
    const a = await this.prisma.db.assessment.create({
      data: {
        tenantId: tid(),
        termId: dto.termId,
        classId: dto.classId,
        subjectId: dto.subjectId,
        name: dto.name.trim(),
        type: dto.type ?? 'CA',
        maxScore: money(dto.maxScore ?? 100),
        weight: money(dto.weight ?? 1),
        date: dto.date ? new Date(dto.date) : null,
        createdById: ctx().userId,
      },
      include: { subject: true },
    });
    await this.audit.log({ action: 'ASSESSMENT_CREATED', entity: 'Assessment', entityId: a.id, after: dto });
    return a;
  }

  async updateAssessment(id: string, dto: Partial<AssessmentDto>) {
    const a = await this.prisma.db.assessment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Assessment not found');
    await this.students.assertClassAccess(a.classId);
    return this.prisma.db.assessment.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        type: dto.type,
        maxScore: dto.maxScore !== undefined ? money(dto.maxScore) : undefined,
        weight: dto.weight !== undefined ? money(dto.weight) : undefined,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  async deleteAssessment(id: string) {
    const a = await this.prisma.db.assessment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Assessment not found');
    await this.students.assertClassAccess(a.classId);
    await this.prisma.db.assessment.delete({ where: { id } });
    await this.audit.log({ action: 'ASSESSMENT_DELETED', entity: 'Assessment', entityId: id, before: a });
    return { ok: true };
  }

  async marks(assessmentId: string) {
    const a = await this.prisma.db.assessment.findUnique({
      where: { id: assessmentId },
      include: { subject: true, marks: true },
    });
    if (!a) throw new NotFoundException('Assessment not found');
    const students = await this.prisma.db.student.findMany({
      where: { classId: a.classId, status: 'ACTIVE' },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, studentId: true, firstName: true, lastName: true },
    });
    const map = new Map(a.marks.map((m) => [m.studentId, m]));
    return {
      assessment: { ...a, marks: undefined },
      students: students.map((s) => ({
        ...s,
        score: map.get(s.id)?.score ?? null,
        updatedAt: map.get(s.id)?.updatedAt ?? null,
      })),
    };
  }

  async saveMarks(assessmentId: string, dto: SaveMarksDto) {
    const a = await this.prisma.db.assessment.findUnique({ where: { id: assessmentId } });
    if (!a) throw new NotFoundException('Assessment not found');
    await this.students.assertClassAccess(a.classId);
    const locked = await this.prisma.db.resultSheet.count({
      where: { termId: a.termId, classId: a.classId, status: 'PUBLISHED' },
    });
    if (locked && !hasPermission(ctx().permissions, 'RESULT_PUBLISH'))
      throw new ForbiddenException(
        'Results for this class are already published. Ask an administrator to unlock them.',
      );
    const max = Number(a.maxScore);
    for (const m of dto.marks)
      if (m.score !== null && m.score !== undefined && (m.score < 0 || m.score > max))
        throw new BadRequestException(`Score for student ${m.studentId} must be between 0 and ${max}`);
    const tenantId = tid();
    let saved = 0,
      cleared = 0;
    await this.prisma.tenantTx(async (tx) => {
      for (const m of dto.marks) {
        if (m.score === null || m.score === undefined) {
          const r = await tx.mark.deleteMany({ where: { assessmentId, studentId: m.studentId } });
          cleared += r.count;
          continue;
        }
        await tx.mark.upsert({
          where: { assessmentId_studentId: { assessmentId, studentId: m.studentId } },
          create: { tenantId, assessmentId, studentId: m.studentId, score: money(m.score), enteredById: ctx().userId },
          update: { score: money(m.score), enteredById: ctx().userId },
        });
        saved++;
      }
    });
    await this.audit.log({
      action: 'MARKS_SAVED',
      entity: 'Assessment',
      entityId: assessmentId,
      after: { saved, cleared },
    });
    return { saved, cleared };
  }

  // ─────────────────────────── Computation ───────────────────────────
  async compute(dto: ComputeDto) {
    await this.students.assertClassAccess(dto.classId);
    const db = this.prisma.db;
    const tenantId = tid();
    const settings = await this.tenants.settings(tenantId);
    const { gradingScheme, caWeight, examWeight, promotionAverage, passMark } = settings.academic;
    const term = await db.term.findUnique({ where: { id: dto.termId } });
    if (!term) throw new NotFoundException('Term not found');
    const lastSeq = await db.term.aggregate({
      where: { academicYearId: term.academicYearId },
      _max: { sequence: true },
    });
    const finalTerm = term.sequence === (lastSeq._max.sequence ?? term.sequence);
    const [classSubjects, students, assessments, attendance, existing] = await Promise.all([
      db.classSubject.findMany({
        where: { classId: dto.classId },
        include: { subject: { select: { id: true, name: true, code: true } } },
        orderBy: { subject: { name: 'asc' } },
      }),
      db.student.findMany({ where: { classId: dto.classId, status: 'ACTIVE' }, select: { id: true } }),
      db.assessment.findMany({
        where: { termId: dto.termId, classId: dto.classId },
        include: { marks: { select: { studentId: true, score: true } } },
      }),
      db.attendance.findMany({
        where: { classId: dto.classId, date: { gte: term.startDate, lte: term.endDate } },
        select: { studentId: true, status: true, date: true },
      }),
      db.resultSheet.findMany({
        where: { termId: dto.termId, classId: dto.classId },
        select: { id: true, studentId: true, status: true },
      }),
    ]);
    if (!classSubjects.length) throw new BadRequestException('Assign subjects to this class before computing results');
    const schoolDays = new Set(attendance.map((a) => a.date.toISOString())).size;
    const presentBy = new Map<string, number>();
    for (const a of attendance)
      if (a.status === 'PRESENT' || a.status === 'LATE')
        presentBy.set(a.studentId, (presentBy.get(a.studentId) ?? 0) + 1);

    const pct = (list: typeof assessments, studentId: string) => {
      let wsum = 0,
        acc = 0,
        any = false;
      for (const a of list) {
        const m = a.marks.find((x) => x.studentId === studentId);
        if (!m) continue;
        any = true;
        const w = Number(a.weight) || 1;
        acc += (Number(m.score) / Number(a.maxScore)) * w;
        wsum += w;
      }
      return any && wsum > 0 ? acc / wsum : null;
    };

    const sheets = students.map((s) => {
      const subjects = classSubjects.map((cs) => {
        const subjAss = assessments.filter((a) => a.subjectId === cs.subjectId);
        const caPct = pct(
          subjAss.filter((a) => a.type !== 'EXAM'),
          s.id,
        );
        const examPct = pct(
          subjAss.filter((a) => a.type === 'EXAM'),
          s.id,
        );
        const ca = caPct === null ? 0 : caPct * caWeight;
        const exam = examPct === null ? 0 : examPct * examWeight;
        const hasMarks = caPct !== null || examPct !== null;
        const total = round1(ca + exam);
        const g = hasMarks ? this.gradeFor(total, gradingScheme) : { grade: null, remark: 'No marks' };
        return {
          subjectId: cs.subjectId,
          name: cs.subject.name,
          code: cs.subject.code,
          ca: round1(ca),
          exam: round1(exam),
          total,
          grade: g.grade,
          remark: g.remark,
          hasMarks,
          position: null as number | null,
          teacherId: cs.teacherId,
        };
      });
      const graded = subjects.filter((x) => x.hasMarks);
      const totalScore = round1(graded.reduce((a, x) => a + x.total, 0));
      const average = graded.length ? round1(totalScore / graded.length) : 0;
      return { studentId: s.id, subjects, totalScore, average, gradedCount: graded.length };
    });

    // Overall positions (dense ranking on average; ungraded students unranked)
    const ranked = sheets.filter((x) => x.gradedCount > 0).sort((a, b) => b.average - a.average);
    const positions = new Map<string, number>();
    let pos = 0,
      prev: number | null = null;
    ranked.forEach((r) => {
      if (prev === null || r.average < prev) pos++;
      prev = r.average;
      positions.set(r.studentId, pos);
    });
    // Subject positions
    for (const cs of classSubjects) {
      const entries = sheets
        .map((sh) => sh.subjects.find((x) => x.subjectId === cs.subjectId))
        .filter((x) => x.hasMarks)
        .sort((a, b) => b.total - a.total);
      let p = 0,
        pv: number | null = null;
      for (const e of entries) {
        if (pv === null || e.total < pv) p++;
        pv = e.total;
        e.position = p;
      }
    }

    let computed = 0,
      skipped = 0;
    await this.prisma.tenantTx(async (tx) => {
      for (const sh of sheets) {
        const ex = existing.find((e) => e.studentId === sh.studentId);
        if (ex && ex.status === 'PUBLISHED' && !dto.force) {
          skipped++;
          continue;
        }
        const g = sh.gradedCount ? this.gradeFor(sh.average, gradingScheme) : { grade: null };
        const promotionStatus = !sh.gradedCount
          ? null
          : finalTerm
            ? sh.average >= promotionAverage
              ? 'PROMOTED'
              : 'NOT PROMOTED'
            : sh.average >= passMark
              ? 'ON TRACK'
              : 'AT RISK';
        const data = {
          subjects: toJson(sh.subjects),
          totalScore: money(sh.totalScore),
          average: money(sh.average),
          position: positions.get(sh.studentId) ?? null,
          classSize: students.length,
          overallGrade: g.grade,
          attendancePresent: presentBy.get(sh.studentId) ?? 0,
          attendanceTotal: schoolDays,
          promotionStatus,
          computedAt: new Date(),
        };
        if (ex)
          await tx.resultSheet.update({
            where: { id: ex.id },
            data: {
              ...data,
              status: 'DRAFT',
              submittedAt: null,
              reviewedAt: null,
              approvedAt: null,
              publishedAt: null,
              rejectionReason: null,
            },
          });
        else
          await tx.resultSheet.create({
            data: { tenantId, termId: dto.termId, classId: dto.classId, studentId: sh.studentId, ...data },
          });
        computed++;
      }
    });
    await this.audit.log({
      action: 'RESULTS_COMPUTED',
      entity: 'SchoolClass',
      entityId: dto.classId,
      after: { termId: dto.termId, computed, skipped, force: !!dto.force },
    });
    return {
      computed,
      skipped,
      students: students.length,
      subjects: classSubjects.length,
      assessments: assessments.length,
      schoolDays,
    };
  }

  // ─────────────────────────── Sheets & workflow ───────────────────────────
  private chain(levels: string[]) {
    return [
      'DRAFT',
      'SUBMITTED',
      ...(levels.includes('REVIEW') ? ['REVIEWED'] : []),
      ...(levels.includes('APPROVE') ? ['APPROVED'] : []),
      'PUBLISHED',
    ];
  }

  async workflowInfo() {
    const s = await this.tenants.settings(tid());
    return { levels: s.academic.resultApprovalLevels, chain: this.chain(s.academic.resultApprovalLevels) };
  }

  async transition(action: Action, dto: WorkflowDto) {
    const settings = await this.tenants.settings(tid());
    const chain = this.chain(settings.academic.resultApprovalLevels);
    const targetOf: Record<Exclude<Action, 'reject'>, string> = {
      submit: 'SUBMITTED',
      review: 'REVIEWED',
      approve: 'APPROVED',
      publish: 'PUBLISHED',
    };
    const base: any = { termId: dto.termId, classId: dto.classId };
    if (dto.studentIds?.length) base.studentId = { in: dto.studentIds };
    let count = 0;
    if (action === 'reject') {
      if (!dto.reason) throw new BadRequestException('A reason is required to send results back');
      const r = await this.prisma.db.resultSheet.updateMany({
        where: { ...base, status: { in: ['SUBMITTED', 'REVIEWED', 'APPROVED'] } },
        data: { status: 'DRAFT', rejectionReason: dto.reason, submittedAt: null, reviewedAt: null, approvedAt: null },
      });
      count = r.count;
    } else {
      if (action === 'submit') await this.students.assertClassAccess(dto.classId);
      const target = targetOf[action];
      if (!chain.includes(target))
        throw new BadRequestException(
          `"${action}" is not part of this school's approval workflow (${chain.join(' → ')})`,
        );
      const from = chain[chain.indexOf(target) - 1];
      const stamp: any = {
        SUBMITTED: { submittedAt: new Date(), rejectionReason: null },
        REVIEWED: { reviewedAt: new Date() },
        APPROVED: { approvedAt: new Date() },
        PUBLISHED: { publishedAt: new Date() },
      }[target];
      const r = await this.prisma.db.resultSheet.updateMany({
        where: { ...base, status: from as any },
        data: { status: target as any, ...stamp },
      });
      count = r.count;
      if (count === 0)
        throw new BadRequestException(`No result sheets in "${from}" state. Current chain: ${chain.join(' → ')}`);
      if (target === 'PUBLISHED') await this.notifyPublished(dto.termId, dto.classId);
    }
    await this.audit.log({
      action: `RESULTS_${action.toUpperCase()}`,
      entity: 'SchoolClass',
      entityId: dto.classId,
      after: { termId: dto.termId, count, studentIds: dto.studentIds },
      reason: dto.reason,
    });
    return { action, count, chain };
  }

  private async notifyPublished(termId: string, classId: string) {
    try {
      const sheets = await this.prisma.db.resultSheet.findMany({
        where: { termId, classId, status: 'PUBLISHED' },
        select: { studentId: true },
      });
      const links = await this.prisma.db.studentGuardian.findMany({
        where: { studentId: { in: sheets.map((s) => s.studentId) } },
        include: { guardian: { select: { userId: true } }, student: { select: { userId: true, firstName: true } } },
      });
      const term = await this.prisma.db.term.findUnique({ where: { id: termId } });
      const rows = new Map<string, any>();
      for (const l of links) {
        if (l.guardian.userId)
          rows.set(l.guardian.userId, {
            tenantId: tid(),
            userId: l.guardian.userId,
            title: 'Results published',
            body: `${term?.name ?? 'Term'} results for ${l.student.firstName} are now available in the parent portal.`,
            type: 'RESULTS',
            data: { termId, classId },
          });
        if (l.student.userId)
          rows.set(l.student.userId, {
            tenantId: tid(),
            userId: l.student.userId,
            title: 'Results published',
            body: `Your ${term?.name ?? 'term'} results are now available.`,
            type: 'RESULTS',
            data: { termId, classId },
          });
      }
      if (rows.size) await this.prisma.db.notification.createMany({ data: [...rows.values()] });
    } catch {
      /* best-effort */
    }
  }

  async sheets(termId: string, classId?: string, status?: string) {
    const where: any = { termId };
    if (classId) where.classId = classId;
    if (status) where.status = status;
    const rows = await this.prisma.db.resultSheet.findMany({
      where,
      orderBy: [{ position: 'asc' }, { average: 'desc' }],
      include: { student: { select: { id: true, studentId: true, firstName: true, lastName: true, gender: true } } },
    });
    return rows.map(({ subjects, ...r }) => ({
      ...r,
      subjectCount: Array.isArray(subjects) ? (subjects as any[]).filter((s) => s.hasMarks).length : 0,
    }));
  }

  async sheet(id: string) {
    const s = await this.prisma.db.resultSheet.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            otherNames: true,
            gender: true,
            photoUrl: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!s) throw new NotFoundException('Result sheet not found');
    const [term, settings] = await Promise.all([
      this.prisma.db.term.findUnique({
        where: { id: s.termId },
        include: { academicYear: { select: { name: true } } },
      }),
      this.tenants.settings(tid()),
    ]);
    return { ...s, term, workflow: this.chain(settings.academic.resultApprovalLevels) };
  }

  async comments(id: string, dto: CommentsDto) {
    const s = await this.prisma.db.resultSheet.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Result sheet not found');
    if (s.status === 'PUBLISHED' && !hasPermission(ctx().permissions, 'RESULT_PUBLISH'))
      throw new ForbiddenException('Published results cannot be edited');
    const u = await this.prisma.db.resultSheet.update({ where: { id }, data: { ...dto } });
    await this.audit.log({ action: 'RESULT_COMMENTS_UPDATED', entity: 'ResultSheet', entityId: id, after: dto });
    return u;
  }

  async termOverview(termId: string) {
    const rows = await this.prisma.db.resultSheet.groupBy({
      by: ['classId', 'status'],
      where: { termId },
      _count: { _all: true },
      _avg: { average: true },
    });
    const classes = await this.prisma.db.schoolClass.findMany({
      select: { id: true, name: true, _count: { select: { students: { where: { status: 'ACTIVE' } } } } },
      orderBy: { name: 'asc' },
    });
    return classes.map((c) => {
      const mine = rows.filter((r) => r.classId === c.id);
      const total = mine.reduce((a, r) => a + r._count._all, 0);
      return {
        classId: c.id,
        name: c.name,
        enrolled: c._count.students,
        sheets: total,
        byStatus: Object.fromEntries(mine.map((r) => [r.status, r._count._all])),
        averageOfAverages: total
          ? round1(mine.reduce((a, r) => a + Number(r._avg.average ?? 0) * r._count._all, 0) / total)
          : null,
      };
    });
  }

  async reportCardPdf(id: string) {
    const s = await this.sheet(id);
    const [snap, tenant, year] = await Promise.all([
      this.tenants.get(tid()),
      this.prisma.db.tenant.findUnique({ where: { id: tid() }, select: { address: true, phone: true, email: true } }),
      this.prisma.db.academicYear.findUnique({ where: { id: s.term.academicYearId } }),
    ]);
    const buf = await this.pdf.reportCard({
      school: { name: snap.name, code: snap.code, primaryColor: snap.primaryColor, ...tenant },
      student: s.student,
      term: s.term,
      year,
      sheet: s,
      scheme: snap.settings.academic.gradingScheme,
    });
    return { buffer: buf, filename: `${s.student.studentId}-${s.term.name.replace(/\s+/g, '_')}-report.pdf` };
  }
}
