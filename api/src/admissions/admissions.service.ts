import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StudentsService } from '../students/students.service';
import { requestContext, tid } from '../common/context/request-context';
import { nextSequence, pad, paginate, toDateOnly } from '../common/utils';
import { AdmissionStatusDto, AdmitDto, ApplyDto, ListAdmissionsDto } from './dto';

@Injectable()
export class AdmissionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private students: StudentsService,
  ) {}

  /** Public online application (no auth). Runs inside an explicit tenant context. */
  async apply(slug: string, dto: ApplyDto) {
    const tenant = await this.prisma.platform.tenant.findUnique({ where: { slug: slug.toLowerCase() } });
    if (!tenant || tenant.status !== 'ACTIVE')
      throw new NotFoundException('School not found or not accepting applications');
    const admissionsOpen = (tenant.websiteConfig as any)?.pages?.admissions?.open;
    if (admissionsOpen === false)
      throw new BadRequestException('This school is not accepting online applications right now');
    return requestContext.run(
      { tenantId: tenant.id, actorType: 'SYSTEM', actorName: `Applicant ${dto.guardianName}` },
      async () => {
        const a = await this.prisma.tenantTx(async (tx) => {
          const seq = await nextSequence(tx, tenant.id, 'admission');
          return tx.admission.create({
            data: {
              tenantId: tenant.id,
              applicationNumber: `APP-${new Date().getFullYear()}-${pad(seq, 5)}`,
              firstName: dto.firstName.trim(),
              lastName: dto.lastName.trim(),
              gender: dto.gender,
              dateOfBirth: toDateOnly(dto.dateOfBirth),
              appliedLevel: dto.appliedLevel.toUpperCase(),
              appliedClassId: dto.appliedClassId ?? null,
              guardianName: dto.guardianName.trim(),
              guardianPhone: dto.guardianPhone.replace(/\s+/g, ''),
              guardianEmail: dto.guardianEmail?.toLowerCase(),
              previousSchool: dto.previousSchool,
              documents: dto.documents ?? undefined,
            },
          });
        });
        await this.audit.log({
          action: 'ADMISSION_APPLIED',
          entity: 'Admission',
          entityId: a.id,
          after: { applicationNumber: a.applicationNumber },
        });
        const admins = await this.prisma.db.user.findMany({
          where: {
            isActive: true,
            roles: { some: { role: { permissions: { hasSome: ['*', 'ADMISSIONS_MANAGE'] } } } },
          },
          select: { id: true },
        });
        if (admins.length)
          await this.prisma.db.notification.createMany({
            data: admins.map((u) => ({
              tenantId: tenant.id,
              userId: u.id,
              title: 'New admission application',
              body: `${a.firstName} ${a.lastName} applied for ${a.appliedLevel} (${a.applicationNumber})`,
              type: 'ADMISSIONS',
              data: { admissionId: a.id },
            })),
          });
        return {
          applicationNumber: a.applicationNumber,
          status: a.status,
          message: 'Application received. The school will contact you.',
        };
      },
    );
  }

  async list(q: ListAdmissionsDto) {
    const { skip, take, page, pageSize } = paginate(q.page, q.pageSize);
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.search)
      where.OR = [
        { firstName: { contains: q.search, mode: 'insensitive' } },
        { lastName: { contains: q.search, mode: 'insensitive' } },
        { applicationNumber: { contains: q.search, mode: 'insensitive' } },
        { guardianPhone: { contains: q.search } },
      ];
    const [items, total, byStatus] = await Promise.all([
      this.prisma.db.admission.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.db.admission.count({ where }),
      this.prisma.db.admission.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    return {
      items,
      total,
      page,
      pageSize,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    };
  }

  async get(id: string) {
    const a = await this.prisma.db.admission.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Application not found');
    return a;
  }

  async setStatus(id: string, dto: AdmissionStatusDto) {
    const a = await this.get(id);
    if (a.status === 'ADMITTED') throw new BadRequestException('Applicant is already admitted');
    const u = await this.prisma.db.admission.update({
      where: { id },
      data: {
        status: dto.status,
        notes: dto.notes ?? a.notes,
        interviewAt: dto.interviewAt ? new Date(dto.interviewAt) : a.interviewAt,
      },
    });
    await this.audit.log({
      action: 'ADMISSION_STATUS_CHANGED',
      entity: 'Admission',
      entityId: id,
      before: { status: a.status },
      after: { status: dto.status },
      reason: dto.notes,
    });
    return u;
  }

  /** Converts an approved application into a student record with the guardian linked. */
  async admit(id: string, dto: AdmitDto) {
    const a = await this.get(id);
    if (a.status === 'ADMITTED') throw new BadRequestException('Already admitted');
    if (!['APPROVED', 'ASSESSMENT', 'INTERVIEW', 'UNDER_REVIEW', 'SUBMITTED'].includes(a.status))
      throw new BadRequestException('Only approved applications can be admitted');
    const [gFirst, ...gRest] = a.guardianName.split(' ');
    const student = await this.students.create({
      firstName: a.firstName,
      lastName: a.lastName,
      gender: a.gender as any,
      dateOfBirth: a.dateOfBirth.toISOString(),
      classId: dto.classId,
      admissionDate: dto.admissionDate,
      previousSchool: a.previousSchool ?? undefined,
      guardian: {
        firstName: gFirst,
        lastName: gRest.join(' ') || gFirst,
        phone: a.guardianPhone,
        email: a.guardianEmail ?? undefined,
        relationship: 'PARENT',
      },
    });
    await this.prisma.db.admission.update({ where: { id }, data: { status: 'ADMITTED', studentId: student.id } });
    await this.audit.log({
      action: 'ADMISSION_ADMITTED',
      entity: 'Admission',
      entityId: id,
      after: { studentId: student.id, studentNumber: student.studentId },
    });
    return { admission: { id, status: 'ADMITTED' }, student };
  }
}
