import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { UsersService } from '../users/users.service';
import { ctx, tid } from '../common/context/request-context';
import { addDays, nextSequence, pad, paginate, toDateOnly } from '../common/utils';
import { CreateStudentDto, GuardianInlineDto, ListStudentsDto, PromoteDto, UpdateStudentDto } from './dto';

const QR_PREFIX = 'SOS1';

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private tenants: TenantCacheService,
    private users: UsersService,
  ) {}

  async list(q: ListStudentsDto) {
    const { skip, take, page, pageSize } = paginate(q.page, q.pageSize);
    const where: any = {};
    if (q.classId) where.classId = q.classId;
    if (q.status) where.status = q.status;
    else where.status = { not: 'INACTIVE' };
    if (q.gender) where.gender = q.gender;
    if (q.residency) where.isBoarding = q.residency === 'BOARDING';
    if (q.search)
      where.OR = [
        { firstName: { contains: q.search, mode: 'insensitive' } },
        { lastName: { contains: q.search, mode: 'insensitive' } },
        { otherNames: { contains: q.search, mode: 'insensitive' } },
        { studentId: { contains: q.search, mode: 'insensitive' } },
      ];
    const [items, total] = await Promise.all([
      this.prisma.db.student.findMany({
        where,
        skip,
        take,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          class: { select: { id: true, name: true, level: true } },
          account: { select: { balance: true } },
          guardians: {
            where: { isPrimary: true },
            include: { guardian: { select: { id: true, firstName: true, lastName: true, phone: true } } },
          },
        },
      }),
      this.prisma.db.student.count({ where }),
    ]);
    return {
      items: items.map((s) => ({
        ...s,
        balance: s.account?.balance ?? 0,
        primaryGuardian: s.guardians[0]?.guardian ?? null,
        account: undefined,
        guardians: undefined,
      })),
      total,
      page,
      pageSize,
    };
  }

  async get(id: string) {
    const db = this.prisma.db;
    const s = await db.student.findUnique({
      where: { id },
      include: {
        class: {
          select: { id: true, name: true, level: true, classTeacher: { select: { firstName: true, lastName: true } } },
        },
        account: true,
        wallet: { select: { balance: true, isActive: true } },
        guardians: {
          include: { guardian: { include: { user: { select: { id: true, email: true, isActive: true } } } } },
        },
        user: { select: { id: true, email: true, isActive: true } },
      },
    });
    if (!s) throw new NotFoundException('Student not found');
    const since = addDays(new Date(), -30);
    const [attendance, invoices, latestResult] = await Promise.all([
      db.attendance.groupBy({ by: ['status'], where: { studentId: id, date: { gte: since } }, _count: { _all: true } }),
      db.invoice.aggregate({
        where: { studentId: id, status: { not: 'CANCELLED' } },
        _sum: { total: true, paidTotal: true },
      }),
      db.resultSheet.findFirst({
        where: { studentId: id },
        orderBy: { computedAt: 'desc' },
        select: { termId: true, average: true, position: true, classSize: true, overallGrade: true, status: true },
      }),
    ]);
    return {
      ...s,
      attendance30d: Object.fromEntries(attendance.map((a) => [a.status, a._count._all])),
      fees: {
        invoiced: invoices._sum.total ?? 0,
        paid: invoices._sum.paidTotal ?? 0,
        balance: s.account?.balance ?? 0,
      },
      latestResult,
    };
  }

  private async enforcePlanLimit() {
    const snap = await this.tenants.get(tid());
    const count = await this.prisma.db.student.count({ where: { status: 'ACTIVE' } });
    if (snap && snap.studentLimit && count >= snap.studentLimit) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_REACHED',
        message: `Your ${snap.planName} plan allows ${snap.studentLimit} active students. Upgrade your plan to add more.`,
      });
    }
  }

  async findOrCreateGuardian(tx: Tx, g: GuardianInlineDto) {
    const tenantId = tid();
    const phone = g.phone.replace(/\s+/g, '');
    const existing = await tx.guardian.findFirst({ where: { tenantId, phone } });
    if (existing) return existing;
    return tx.guardian.create({
      data: {
        tenantId,
        firstName: g.firstName.trim(),
        lastName: g.lastName.trim(),
        phone,
        email: g.email?.toLowerCase(),
        occupation: g.occupation,
        address: g.address,
      },
    });
  }

  /**
   * Day schools cannot enrol boarders and boarding schools have only boarders; mixed schools choose per student.
   * Returns the residency-corrected boarding flag.
   */
  private async applyResidency(isBoarding: boolean | undefined): Promise<boolean | undefined> {
    const settings = await this.tenants.settings(tid());
    const residency = settings.school?.residency ?? 'DAY_AND_BOARDING';
    if (residency === 'DAY') {
      if (isBoarding) throw new BadRequestException('This is a day school. Students cannot be registered as boarders. Change residency under Settings > Profile.');
      return isBoarding === undefined ? undefined : false;
    }
    if (residency === 'BOARDING') return isBoarding === undefined ? undefined : true;
    return isBoarding;
  }

  async create(dto: CreateStudentDto) {
    await this.enforcePlanLimit();
    dto.isBoarding = (await this.applyResidency(dto.isBoarding ?? false)) ?? false;
    if (dto.classId) {
      const cls = await this.prisma.db.schoolClass.findUnique({ where: { id: dto.classId } });
      if (!cls) throw new BadRequestException('Class not found');
    }
    const student = await this.prisma.tenantTx(async (tx) => {
      const tenantId = tid();
      const admission = dto.admissionDate ? new Date(dto.admissionDate) : new Date();
      const seq = await nextSequence(tx, tenantId, 'student');
      const studentId = `STD-${admission.getUTCFullYear()}-${pad(seq, 6)}`;
      const s = await tx.student.create({
        data: {
          tenantId,
          studentId,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          otherNames: dto.otherNames?.trim(),
          gender: dto.gender,
          dateOfBirth: toDateOnly(dto.dateOfBirth),
          classId: dto.classId || null,
          house: dto.house,
          admissionDate: admission,
          isBoarding: !!dto.isBoarding,
          photoUrl: dto.photoUrl,
          previousSchool: dto.previousSchool,
          address: dto.address,
          medicalNotes: dto.medicalNotes,
          emergencyContactName: dto.emergencyContactName,
          emergencyContactPhone: dto.emergencyContactPhone,
          account: { create: { tenantId } },
        },
      });
      let guardianId = dto.guardianId;
      if (!guardianId && dto.guardian) guardianId = (await this.findOrCreateGuardian(tx, dto.guardian)).id;
      if (guardianId) {
        const g = await tx.guardian.findUnique({ where: { id: guardianId } });
        if (!g) throw new BadRequestException('Guardian not found');
        await tx.studentGuardian.create({
          data: {
            tenantId,
            studentId: s.id,
            guardianId,
            relationship: dto.guardian?.relationship ?? 'PARENT',
            isPrimary: true,
          },
        });
      }
      return s;
    });
    await this.audit.log({
      action: 'STUDENT_CREATED',
      entity: 'Student',
      entityId: student.id,
      after: {
        studentId: student.studentId,
        name: `${student.firstName} ${student.lastName}`,
        classId: student.classId,
      },
    });
    return this.get(student.id);
  }

  async update(id: string, dto: UpdateStudentDto) {
    const before = await this.prisma.db.student.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Student not found');
    const data: any = { ...dto, version: { increment: 1 } };
    if (dto.isBoarding !== undefined) data.isBoarding = await this.applyResidency(dto.isBoarding);
    if (dto.dateOfBirth) data.dateOfBirth = toDateOnly(dto.dateOfBirth);
    if (dto.classId === null) data.classId = null;
    const s = await this.prisma.db.student.update({ where: { id }, data });
    await this.audit.log({
      action: 'STUDENT_UPDATED',
      entity: 'Student',
      entityId: id,
      before: pickChanged(before, dto),
      after: dto,
    });
    return s;
  }

  async promote(dto: PromoteDto) {
    const cls = await this.prisma.db.schoolClass.findUnique({ where: { id: dto.toClassId } });
    if (!cls) throw new BadRequestException('Target class not found');
    const r = await this.prisma.db.student.updateMany({
      where: { id: { in: dto.studentIds } },
      data: { classId: dto.toClassId, version: { increment: 1 } },
    });
    await this.audit.log({
      action: 'STUDENTS_MOVED',
      entity: 'SchoolClass',
      entityId: dto.toClassId,
      after: { count: r.count, studentIds: dto.studentIds },
    });
    return { moved: r.count };
  }

  async createLogin(id: string) {
    const s = await this.prisma.db.student.findUnique({ where: { id }, include: { user: true } });
    if (!s) throw new NotFoundException('Student not found');
    if (s.userId) throw new BadRequestException('Student already has a login');
    const snap = await this.tenants.get(tid());
    const email = `${s.studentId.toLowerCase()}@${snap.slug}.student`;
    const { user, temporaryPassword } = await this.users.createLogin(this.prisma.db, {
      email,
      firstName: s.firstName,
      lastName: s.lastName,
      userType: 'STUDENT',
      roleNames: ['Student'],
    });
    await this.prisma.db.student.update({ where: { id }, data: { userId: user.id } });
    await this.audit.log({ action: 'STUDENT_LOGIN_CREATED', entity: 'Student', entityId: id, after: { email } });
    return { email, temporaryPassword };
  }

  // ── ID cards & QR verification ──
  private sign(tenantCode: string, studentId: string) {
    return createHmac('sha256', process.env.JWT_SECRET || 'dev-access-secret')
      .update(`${tenantCode}|${studentId}`)
      .digest('hex')
      .slice(0, 16);
  }

  async idCard(id: string) {
    const s = await this.prisma.db.student.findUnique({
      where: { id },
      include: {
        class: { select: { name: true } },
        guardians: {
          where: { isPrimary: true },
          include: { guardian: { select: { phone: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!s) throw new NotFoundException('Student not found');
    const snap = await this.tenants.get(tid());
    const year = await this.prisma.db.academicYear.findFirst({ where: { isCurrent: true } });
    return {
      student: {
        id: s.id,
        studentId: s.studentId,
        name: `${s.firstName} ${s.otherNames ? s.otherNames + ' ' : ''}${s.lastName}`,
        className: s.class?.name ?? '',
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        photoUrl: s.photoUrl,
        house: s.house,
        emergencyPhone: s.guardians[0]?.guardian.phone ?? s.emergencyContactPhone ?? '',
      },
      school: {
        name: snap.name,
        code: snap.code,
        logoUrl: snap.logoUrl,
        primaryColor: snap.primaryColor,
        secondaryColor: snap.secondaryColor,
      },
      academicYear: year?.name ?? '',
      qrPayload: `${QR_PREFIX}|${snap.code}|${s.studentId}|${this.sign(snap.code, s.studentId)}`,
    };
  }

  async verifyQr(payload: string) {
    const [prefix, tenantCode, studentId, sig] = (payload || '').split('|');
    if (prefix !== QR_PREFIX || !tenantCode || !studentId || !sig) throw new BadRequestException('Invalid QR code');
    const snap = await this.tenants.get(tid());
    if (snap.code !== tenantCode) throw new ForbiddenException('This ID card belongs to another school');
    if (this.sign(tenantCode, studentId) !== sig)
      throw new BadRequestException('QR signature is invalid, possible forged card');
    const s = await this.prisma.db.student.findFirst({
      where: { studentId },
      include: { class: { select: { id: true, name: true } }, wallet: { select: { balance: true, isActive: true } } },
    });
    if (!s) throw new NotFoundException('Student not found');
    return {
      valid: s.status === 'ACTIVE',
      student: {
        id: s.id,
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        status: s.status,
        class: s.class,
        photoUrl: s.photoUrl,
        wallet: s.wallet,
      },
    };
  }

  /** Teacher scoping helper: may the current user act on this class? */
  async assertClassAccess(classId: string) {
    const c = ctx();
    if (c.permissions?.includes('*') || c.permissions?.includes('ACADEMIC_MANAGE') || c.userType !== 'TEACHER') return;
    if (!c.staffId) throw new ForbiddenException('No staff profile linked to your account');
    const ok = await this.prisma.db.schoolClass.findFirst({
      where: { id: classId, OR: [{ classTeacherId: c.staffId }, { subjects: { some: { teacherId: c.staffId } } }] },
      select: { id: true },
    });
    if (!ok) throw new ForbiddenException('You are not assigned to this class');
  }
}

function pickChanged(before: any, dto: any) {
  const out: any = {};
  for (const k of Object.keys(dto)) out[k] = before?.[k];
  return out;
}
