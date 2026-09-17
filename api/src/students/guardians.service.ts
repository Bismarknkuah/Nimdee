import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { tid } from '../common/context/request-context';
import { paginate } from '../common/utils';
import { CreateGuardianDto, LinkGuardianDto, ListGuardiansDto } from './dto';
import { StudentsService } from './students.service';

@Injectable()
export class GuardiansService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private users: UsersService,
    private students: StudentsService,
  ) {}

  async list(q: ListGuardiansDto) {
    const { skip, take, page, pageSize } = paginate(q.page, q.pageSize);
    const where: any = {};
    if (q.search)
      where.OR = [
        { firstName: { contains: q.search, mode: 'insensitive' } },
        { lastName: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ];
    const [items, total] = await Promise.all([
      this.prisma.db.guardian.findMany({
        where,
        skip,
        take,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          user: { select: { id: true, email: true, isActive: true, lastLoginAt: true } },
          students: {
            include: {
              student: {
                select: {
                  id: true,
                  studentId: true,
                  firstName: true,
                  lastName: true,
                  class: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.db.guardian.count({ where }),
    ]);
    return {
      items: items.map((g) => ({
        ...g,
        students: g.students.map((s) => ({ ...s.student, relationship: s.relationship, isPrimary: s.isPrimary })),
      })),
      total,
      page,
      pageSize,
    };
  }

  async get(id: string) {
    const g = await this.prisma.db.guardian.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, isActive: true, lastLoginAt: true } },
        students: {
          include: {
            student: { include: { class: { select: { name: true } }, account: { select: { balance: true } } } },
          },
        },
      },
    });
    if (!g) throw new NotFoundException('Guardian not found');
    return {
      ...g,
      students: g.students.map((s) => ({ ...s.student, relationship: s.relationship, isPrimary: s.isPrimary })),
    };
  }

  async create(dto: CreateGuardianDto) {
    const g = await this.prisma.tenantTx((tx) => this.students.findOrCreateGuardian(tx, dto));
    await this.audit.log({
      action: 'GUARDIAN_CREATED',
      entity: 'Guardian',
      entityId: g.id,
      after: { name: `${g.firstName} ${g.lastName}`, phone: g.phone },
    });
    return g;
  }

  async update(id: string, dto: Partial<CreateGuardianDto>) {
    const g = await this.prisma.db.guardian.update({
      where: { id },
      data: {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        phone: dto.phone?.replace(/\s+/g, ''),
        email: dto.email?.toLowerCase(),
        occupation: dto.occupation,
        address: dto.address,
      },
    });
    await this.audit.log({ action: 'GUARDIAN_UPDATED', entity: 'Guardian', entityId: id, after: dto });
    return g;
  }

  async link(studentId: string, dto: LinkGuardianDto) {
    const student = await this.prisma.db.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    if (!dto.guardianId && !dto.guardian) throw new BadRequestException('Provide guardianId or guardian details');
    await this.prisma.tenantTx(async (tx) => {
      const guardianId = dto.guardianId ?? (await this.students.findOrCreateGuardian(tx, dto.guardian)).id;
      if (dto.isPrimary) await tx.studentGuardian.updateMany({ where: { studentId }, data: { isPrimary: false } });
      await tx.studentGuardian.upsert({
        where: { studentId_guardianId: { studentId, guardianId } },
        create: {
          tenantId: tid(),
          studentId,
          guardianId,
          relationship: dto.relationship ?? dto.guardian?.relationship ?? 'PARENT',
          isPrimary: !!dto.isPrimary,
        },
        update: { relationship: dto.relationship, isPrimary: dto.isPrimary },
      });
    });
    await this.audit.log({ action: 'GUARDIAN_LINKED', entity: 'Student', entityId: studentId, after: dto });
    return this.students.get(studentId);
  }

  async unlink(studentId: string, guardianId: string) {
    await this.prisma.db.studentGuardian.delete({ where: { studentId_guardianId: { studentId, guardianId } } });
    await this.audit.log({
      action: 'GUARDIAN_UNLINKED',
      entity: 'Student',
      entityId: studentId,
      after: { guardianId },
    });
    return { ok: true };
  }

  async createLogin(id: string, email?: string) {
    const g = await this.prisma.db.guardian.findUnique({ where: { id } });
    if (!g) throw new NotFoundException('Guardian not found');
    if (g.userId) throw new BadRequestException('Guardian already has a login');
    const loginEmail = (email ?? g.email)?.toLowerCase();
    if (!loginEmail) throw new BadRequestException('Guardian has no email address. Provide one to create a login.');
    const { user, temporaryPassword } = await this.users.createLogin(this.prisma.db, {
      email: loginEmail,
      firstName: g.firstName,
      lastName: g.lastName,
      phone: g.phone,
      userType: 'PARENT',
      roleNames: ['Parent'],
    });
    await this.prisma.db.guardian.update({ where: { id }, data: { userId: user.id, email: loginEmail } });
    await this.audit.log({
      action: 'GUARDIAN_LOGIN_CREATED',
      entity: 'Guardian',
      entityId: id,
      after: { email: loginEmail },
    });
    return { email: loginEmail, temporaryPassword };
  }
}
