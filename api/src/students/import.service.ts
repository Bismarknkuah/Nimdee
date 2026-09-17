import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { tid } from '../common/context/request-context';
import { normaliseHeader, parseCsv, toCsv } from '../common/csv';
import { nextSequence, pad, toDateOnly } from '../common/utils';
import { StudentsService } from './students.service';

export interface ImportRowResult {
  line: number;
  status: 'CREATED' | 'SKIPPED' | 'ERROR';
  studentId?: string;
  name?: string;
  message?: string;
}

/**
 * Bulk enrolment from a spreadsheet. Two phases: `preview` validates every row and reports problems
 * without writing; `commit` creates students (and guardians, matched by phone) in one transaction per row
 * so a bad row never blocks the good ones. Class names are matched case-insensitively.
 */
@Injectable()
export class StudentImportService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private tenants: TenantCacheService,
    private students: StudentsService,
  ) {}

  static readonly COLUMNS = [
    'firstName',
    'lastName',
    'otherNames',
    'gender',
    'dateOfBirth',
    'className',
    'admissionDate',
    'isBoarding',
    'house',
    'previousSchool',
    'address',
    'medicalNotes',
    'guardianFirstName',
    'guardianLastName',
    'guardianPhone',
    'guardianEmail',
    'relationship',
  ];

  template() {
    return toCsv(
      [
        {
          firstName: 'Abena',
          lastName: 'Mensah',
          otherNames: '',
          gender: 'FEMALE',
          dateOfBirth: '2015-04-12',
          className: 'Primary 5',
          admissionDate: '2026-09-01',
          isBoarding: 'NO',
          house: 'Red',
          previousSchool: '',
          address: 'Accra',
          medicalNotes: '',
          guardianFirstName: 'Kofi',
          guardianLastName: 'Mensah',
          guardianPhone: '+233241234567',
          guardianEmail: 'kofi@example.com',
          relationship: 'FATHER',
        },
      ],
      StudentImportService.COLUMNS,
    );
  }

  private normaliseRows(text: string) {
    const parsed = parseCsv(text, { maxRows: 2000 });
    const rows = parsed.rows.map((r) => {
      const o: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) o[normaliseHeader(k)] = v;
      return o;
    });
    return { rows, errors: parsed.errors };
  }

  private parseGender(v: string) {
    const g = (v || '').trim().toUpperCase();
    if (['M', 'MALE', 'BOY'].includes(g)) return 'MALE';
    if (['F', 'FEMALE', 'GIRL'].includes(g)) return 'FEMALE';
    if (g === 'OTHER') return 'OTHER';
    return null;
  }
  private parseDate(v: string) {
    if (!v) return null;
    const m =
      /^(\d{4})-(\d{2})-(\d{2})/.exec(v) ??
      (/^(\d{2})\/(\d{2})\/(\d{4})/.exec(v) ? [null, v.slice(6, 10), v.slice(3, 5), v.slice(0, 2)] : null);
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  private parseBool(v: string) {
    return ['YES', 'Y', 'TRUE', '1', 'BOARDING', 'BOARDER'].includes((v || '').trim().toUpperCase());
  }

  async validate(text: string) {
    const { rows, errors } = this.normaliseRows(text);
    const classes = await this.prisma.db.schoolClass.findMany({ select: { id: true, name: true } });
    const classByName = new Map(classes.map((c) => [c.name.toLowerCase().replace(/\s+/g, ' ').trim(), c]));
    const snap = await this.tenants.get(tid());
    const active = await this.prisma.db.student.count({ where: { status: 'ACTIVE' } });
    const existing = await this.prisma.db.student.findMany({
      select: { firstName: true, lastName: true, dateOfBirth: true },
    });
    const dupKey = (f: string, l: string, d: Date | null) =>
      `${f.toLowerCase()}|${l.toLowerCase()}|${d ? d.toISOString().slice(0, 10) : ''}`;
    const known = new Set(existing.map((e) => dupKey(e.firstName, e.lastName, e.dateOfBirth)));
    const seen = new Set<string>();
    const checked = rows.map((r, i) => {
      const problems: string[] = [];
      if (!r.firstName) problems.push('firstName is required');
      if (!r.lastName) problems.push('lastName is required');
      const gender = this.parseGender(r.gender);
      if (!gender) problems.push('gender must be MALE or FEMALE');
      const dob = this.parseDate(r.dateOfBirth);
      if (!dob) problems.push('dateOfBirth must be YYYY-MM-DD');
      const cls = r.className ? classByName.get(r.className.toLowerCase().replace(/\s+/g, ' ').trim()) : null;
      if (r.className && !cls) problems.push(`class "${r.className}" not found`);
      if (r.guardianPhone && !/^\+?\d{9,15}$/.test(r.guardianPhone.replace(/[\s-]/g, '')))
        problems.push('guardianPhone is not a valid phone number');
      if (r.guardianEmail && !/\S+@\S+\.\S+/.test(r.guardianEmail)) problems.push('guardianEmail is invalid');
      const key = dupKey(r.firstName ?? '', r.lastName ?? '', dob);
      const duplicate = known.has(key) || seen.has(key);
      seen.add(key);
      return {
        line: i + 2,
        row: r,
        gender,
        dob,
        classId: cls?.id ?? null,
        className: cls?.name ?? null,
        problems,
        duplicate,
      };
    });
    const valid = checked.filter((c) => !c.problems.length && !c.duplicate).length;
    const overLimit = snap?.studentLimit ? Math.max(0, active + valid - snap.studentLimit) : 0;
    return {
      total: rows.length,
      valid,
      invalid: checked.filter((c) => c.problems.length).length,
      duplicates: checked.filter((c) => c.duplicate && !c.problems.length).length,
      overLimit,
      parseErrors: errors,
      rows: checked.map((c) => ({
        line: c.line,
        name: `${c.row.firstName ?? ''} ${c.row.lastName ?? ''}`.trim(),
        className: c.className ?? c.row.className ?? '',
        gender: c.gender,
        dateOfBirth: c.dob ? c.dob.toISOString().slice(0, 10) : null,
        guardian: c.row.guardianPhone
          ? `${c.row.guardianFirstName ?? ''} ${c.row.guardianLastName ?? ''} ${c.row.guardianPhone}`.trim()
          : '',
        problems: c.problems,
        duplicate: c.duplicate,
      })),
      checked,
    };
  }

  async commit(text: string, opts: { skipDuplicates?: boolean } = {}) {
    const v = await this.validate(text);
    if (v.overLimit > 0)
      throw new BadRequestException({
        code: 'PLAN_LIMIT_REACHED',
        message: `Importing ${v.valid} students would exceed your plan limit by ${v.overLimit}. Upgrade your plan or import fewer rows.`,
      });
    const tenantId = tid();
    const results: ImportRowResult[] = [];
    for (const c of v.checked) {
      if (c.problems.length) {
        results.push({ line: c.line, status: 'ERROR', message: c.problems.join('; ') });
        continue;
      }
      if (c.duplicate && opts.skipDuplicates !== false) {
        results.push({ line: c.line, status: 'SKIPPED', message: 'Duplicate (same name and date of birth)' });
        continue;
      }
      try {
        const s = await this.prisma.tenantTx(async (tx) => {
          const admission = this.parseDate(c.row.admissionDate) ?? new Date();
          const seq = await nextSequence(tx, tenantId, 'student');
          const st = await tx.student.create({
            data: {
              tenantId,
              studentId: `STD-${admission.getUTCFullYear()}-${pad(seq, 6)}`,
              firstName: c.row.firstName.trim(),
              lastName: c.row.lastName.trim(),
              otherNames: c.row.otherNames || null,
              gender: c.gender as any,
              dateOfBirth: toDateOnly(c.dob!),
              classId: c.classId,
              admissionDate: admission,
              isBoarding: this.parseBool(c.row.isBoarding),
              house: c.row.house || null,
              previousSchool: c.row.previousSchool || null,
              address: c.row.address || null,
              medicalNotes: c.row.medicalNotes || null,
              account: { create: { tenantId } },
            },
          });
          if (c.row.guardianPhone) {
            const g = await this.students.findOrCreateGuardian(tx, {
              firstName: c.row.guardianFirstName || c.row.guardianName?.split(' ')[0] || 'Guardian',
              lastName: c.row.guardianLastName || c.row.guardianName?.split(' ').slice(1).join(' ') || st.lastName,
              phone: c.row.guardianPhone,
              email: c.row.guardianEmail || undefined,
            });
            await tx.studentGuardian.create({
              data: {
                tenantId,
                studentId: st.id,
                guardianId: g.id,
                relationship: (c.row.relationship || 'PARENT').toUpperCase(),
                isPrimary: true,
              },
            });
          }
          return st;
        });
        results.push({ line: c.line, status: 'CREATED', studentId: s.studentId, name: `${s.firstName} ${s.lastName}` });
      } catch (e: any) {
        results.push({ line: c.line, status: 'ERROR', message: e.message });
      }
    }
    const created = results.filter((r) => r.status === 'CREATED').length;
    await this.audit.log({
      action: 'STUDENTS_IMPORTED',
      entity: 'Student',
      entityId: 'bulk',
      after: {
        created,
        skipped: results.filter((r) => r.status === 'SKIPPED').length,
        errors: results.filter((r) => r.status === 'ERROR').length,
      },
    });
    return {
      created,
      skipped: results.filter((r) => r.status === 'SKIPPED').length,
      errors: results.filter((r) => r.status === 'ERROR').length,
      results,
    };
  }
}
