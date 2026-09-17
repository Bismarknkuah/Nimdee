import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { tid } from '../common/context/request-context';
import { toDateOnly } from '../common/utils';
import { RolloverDto } from './rollover.dto';

/**
 * End-of-year rollover: opens the next academic year, promotes every class along its promotion path
 * (SchoolClass.nextClassId), graduates final classes and repeats students below the promotion average.
 * Preview first, then commit — nothing is written during preview.
 */
@Injectable()
export class RolloverService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private tenants: TenantCacheService,
  ) {}

  async preview(dto?: Partial<RolloverDto>) {
    const db = this.prisma.db;
    const settings = await this.tenants.settings(tid());
    const year = await db.academicYear.findFirst({
      where: { isCurrent: true },
      include: { terms: { orderBy: { sequence: 'desc' } } },
    });
    const classes = await db.schoolClass.findMany({
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      include: {
        nextClass: { select: { id: true, name: true } },
        _count: { select: { students: { where: { status: 'ACTIVE' } } } },
      },
    });
    const lastTerm = year?.terms[0];
    const sheets = lastTerm
      ? await db.resultSheet.findMany({
          where: { termId: lastTerm.id },
          select: { studentId: true, average: true, promotionStatus: true },
        })
      : [];
    const overrides = new Map((dto?.promotions ?? []).map((p) => [p.fromClassId, p]));
    const plan = classes.map((c) => {
      const o = overrides.get(c.id);
      const graduate = o ? o.toClassId === 'GRADUATE' : c.isFinal;
      const target =
        o && o.toClassId !== 'GRADUATE'
          ? classes.find((x) => x.id === o.toClassId)
          : c.nextClass
            ? classes.find((x) => x.id === c.nextClass!.id)
            : null;
      return {
        fromClassId: c.id,
        fromClass: c.name,
        level: c.level,
        students: c._count.students,
        action: graduate ? 'GRADUATE' : target ? 'PROMOTE' : 'STAY',
        toClassId: target?.id ?? null,
        toClass: target?.name ?? null,
      };
    });
    const studentIds = await db.student.findMany({ where: { status: 'ACTIVE' }, select: { id: true, classId: true } });
    const repeats =
      dto?.respectResults !== false
        ? sheets.filter((s) => Number(s.average) < settings.academic.promotionAverage).length
        : 0;
    return {
      currentYear: year ? { id: year.id, name: year.name, endDate: year.endDate } : null,
      lastTerm: lastTerm ? { id: lastTerm.id, name: lastTerm.name } : null,
      promotionAverage: settings.academic.promotionAverage,
      plan,
      totals: {
        students: studentIds.length,
        promote: plan.filter((p) => p.action === 'PROMOTE').reduce((a, p) => a + p.students, 0),
        graduate: plan.filter((p) => p.action === 'GRADUATE').reduce((a, p) => a + p.students, 0),
        stay: plan.filter((p) => p.action === 'STAY').reduce((a, p) => a + p.students, 0),
        repeatByResults: repeats,
      },
      suggestedNextYear: year ? this.nextYearName(year.name) : null,
    };
  }

  private nextYearName(name: string) {
    const m = /(\d{4})\s*\/\s*(\d{4})/.exec(name);
    return m ? `${+m[1] + 1}/${+m[2] + 1}` : `${name} (next)`;
  }

  async commit(dto: RolloverDto) {
    const db = this.prisma.db;
    const tenantId = tid();
    const settings = await this.tenants.settings(tenantId);
    if (!dto.terms?.length) throw new BadRequestException('Define at least one term for the new year');
    if (new Date(dto.startDate) >= new Date(dto.endDate))
      throw new BadRequestException('Start date must be before end date');
    const preview = await this.preview(dto);
    const lastTerm = preview.lastTerm;
    const sheets =
      lastTerm && dto.respectResults !== false
        ? await db.resultSheet.findMany({ where: { termId: lastTerm.id }, select: { studentId: true, average: true } })
        : [];
    const below = new Set(
      sheets.filter((s) => Number(s.average) < settings.academic.promotionAverage).map((s) => s.studentId),
    );
    const result = await this.prisma.tenantTx(async (tx) => {
      await tx.academicYear.updateMany({ where: { tenantId }, data: { isCurrent: false } });
      await tx.term.updateMany({ where: { tenantId }, data: { isCurrent: false } });
      const year = await tx.academicYear.create({
        data: {
          tenantId,
          name: dto.newYearName.trim(),
          startDate: toDateOnly(dto.startDate),
          endDate: toDateOnly(dto.endDate),
          isCurrent: true,
        },
      });
      for (const [i, t] of dto.terms.entries())
        await tx.term.create({
          data: {
            tenantId,
            academicYearId: year.id,
            name: t.name,
            sequence: i + 1,
            startDate: toDateOnly(t.startDate),
            endDate: toDateOnly(t.endDate),
            isCurrent: i === 0,
          },
        });
      let promoted = 0,
        graduated = 0,
        repeated = 0;
      const moves: Array<{ fromClassId: string; toClassId: string | null; action: string }> = [];
      for (const p of preview.plan) {
        if (p.action === 'STAY') continue;
        const students = await tx.student.findMany({
          where: { classId: p.fromClassId, status: 'ACTIVE' },
          select: { id: true },
        });
        for (const s of students) {
          if (below.has(s.id)) {
            repeated++;
            continue;
          }
          if (p.action === 'GRADUATE') {
            await tx.student.update({
              where: { id: s.id },
              data: { status: 'GRADUATED', graduatedAt: new Date(), version: { increment: 1 } },
            });
            graduated++;
          } else {
            await tx.student.update({ where: { id: s.id }, data: { classId: p.toClassId, version: { increment: 1 } } });
            promoted++;
          }
        }
        moves.push({ fromClassId: p.fromClassId, toClassId: p.toClassId, action: p.action });
      }
      // Copy fee structures forward when asked so invoicing can start on day one
      if (dto.copyFeeStructures && preview.currentYear) {
        const structures = await tx.feeStructure.findMany({
          where: { academicYearId: preview.currentYear.id, termId: null },
        });
        for (const s of structures)
          await tx.feeStructure.create({
            data: {
              tenantId,
              academicYearId: year.id,
              classId: s.classId,
              level: s.level,
              categoryId: s.categoryId,
              amount: s.amount,
              appliesTo: s.appliesTo,
            },
          });
      }
      return { yearId: year.id, promoted, graduated, repeated, moves };
    });
    this.tenants.invalidate(tenantId);
    await this.audit.log({
      action: 'ACADEMIC_YEAR_ROLLOVER',
      entity: 'AcademicYear',
      entityId: result.yearId,
      after: {
        newYear: dto.newYearName,
        promoted: result.promoted,
        graduated: result.graduated,
        repeated: result.repeated,
      },
    });
    return result;
  }
}
