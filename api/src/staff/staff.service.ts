import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { ctx, tid } from '../common/context/request-context';
import { nextSequence, pad, paginate } from '../common/utils';
import { CreateStaffDto, ListStaffDto, UpdateStaffDto } from './dto';

@Injectable()
export class StaffService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private users: UsersService,
  ) {}

  async list(q: ListStaffDto) {
    const { skip, take, page, pageSize } = paginate(q.page, q.pageSize);
    const where: any = {};
    if (q.staffType) where.staffType = q.staffType;
    if (q.status) where.status = q.status;
    else where.status = { not: 'TERMINATED' };
    if (q.search)
      where.OR = [
        { firstName: { contains: q.search, mode: 'insensitive' } },
        { lastName: { contains: q.search, mode: 'insensitive' } },
        { employeeId: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ];
    const [items, total] = await Promise.all([
      this.prisma.db.staff.findMany({
        where,
        skip,
        take,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          user: {
            select: {
              id: true,
              email: true,
              isActive: true,
              lastLoginAt: true,
              roles: { include: { role: { select: { name: true } } } },
            },
          },
          classTeacherOf: { select: { id: true, name: true } },
          _count: { select: { classSubjects: true } },
        },
      }),
      this.prisma.db.staff.count({ where }),
    ]);
    return {
      items: items.map((s) => ({
        ...s,
        roles: s.user?.roles.map((r) => r.role.name) ?? [],
        subjectAssignments: s._count.classSubjects,
        _count: undefined,
        user: s.user ? { ...s.user, roles: undefined } : null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async get(id: string) {
    const s = await this.prisma.db.staff.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, isActive: true, lastLoginAt: true } },
        classTeacherOf: { select: { id: true, name: true, level: true } },
        classSubjects: {
          include: {
            class: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
    if (!s) throw new NotFoundException('Staff member not found');
    return s;
  }

  async create(dto: CreateStaffDto) {
    if (dto.createLogin && !dto.email) throw new BadRequestException('An email address is required to create a login');
    const result = await this.prisma.tenantTx(async (tx) => {
      const tenantId = tid();
      const seq = await nextSequence(tx, tenantId, 'staff');
      const staff = await tx.staff.create({
        data: {
          tenantId,
          employeeId: `EMP-${pad(seq, 4)}`,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          gender: dto.gender,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          phone: dto.phone,
          email: dto.email?.toLowerCase(),
          staffType: dto.staffType ?? 'TEACHING',
          department: dto.department,
          position: dto.position,
          qualifications: dto.qualifications ?? undefined,
          employmentDate: dto.employmentDate ? new Date(dto.employmentDate) : null,
          basicSalary: dto.basicSalary,
        },
      });
      let login: { email: string; temporaryPassword?: string } | null = null;
      if (dto.createLogin) {
        const isTeacher = (dto.staffType ?? 'TEACHING') === 'TEACHING';
        const { user, temporaryPassword } = await this.users.createLogin(tx, {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          userType: isTeacher ? 'TEACHER' : 'STAFF',
          roleNames: [dto.roleName ?? (isTeacher ? 'Teacher' : 'School Admin')],
          password: dto.password,
        });
        await tx.staff.update({ where: { id: staff.id }, data: { userId: user.id } });
        login = { email: user.email, temporaryPassword };
      }
      return { staff, login };
    });
    await this.audit.log({
      action: 'STAFF_CREATED',
      entity: 'Staff',
      entityId: result.staff.id,
      after: { employeeId: result.staff.employeeId, name: `${dto.firstName} ${dto.lastName}`, login: !!result.login },
    });
    return { ...(await this.get(result.staff.id)), login: result.login };
  }

  async update(id: string, dto: UpdateStaffDto) {
    const before = await this.prisma.db.staff.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Staff member not found');
    const s = await this.prisma.db.staff.update({
      where: { id },
      data: {
        ...dto,
        email: dto.email?.toLowerCase(),
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        employmentDate: dto.employmentDate ? new Date(dto.employmentDate) : undefined,
      },
    });
    if (dto.status === 'TERMINATED' && before.userId)
      await this.prisma.db.user.update({ where: { id: before.userId }, data: { isActive: false } });
    await this.audit.log({ action: 'STAFF_UPDATED', entity: 'Staff', entityId: id, after: dto });
    return s;
  }

  async createLogin(id: string, roleName?: string, email?: string, password?: string) {
    const s = await this.prisma.db.staff.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Staff member not found');
    if (s.userId) throw new BadRequestException('Staff member already has a login');
    const loginEmail = (email ?? s.email)?.toLowerCase();
    if (!loginEmail) throw new BadRequestException('Provide an email address');
    const isTeacher = s.staffType === 'TEACHING';
    const { user, temporaryPassword } = await this.users.createLogin(this.prisma.db, {
      email: loginEmail,
      firstName: s.firstName,
      lastName: s.lastName,
      phone: s.phone,
      userType: isTeacher ? 'TEACHER' : 'STAFF',
      roleNames: [roleName ?? (isTeacher ? 'Teacher' : 'School Admin')],
      password,
    });
    await this.prisma.db.staff.update({ where: { id }, data: { userId: user.id, email: loginEmail } });
    await this.audit.log({
      action: 'STAFF_LOGIN_CREATED',
      entity: 'Staff',
      entityId: id,
      after: { email: loginEmail, role: roleName },
    });
    return { email: loginEmail, temporaryPassword };
  }

  /** Classes and subjects assigned to the calling teacher. */
  async myClasses() {
    const c = ctx();
    if (!c.staffId) return { classTeacherOf: [], teaching: [] };
    const [classTeacherOf, teaching] = await Promise.all([
      this.prisma.db.schoolClass.findMany({
        where: { classTeacherId: c.staffId },
        include: { _count: { select: { students: { where: { status: 'ACTIVE' } } } } },
      }),
      this.prisma.db.classSubject.findMany({
        where: { teacherId: c.staffId },
        include: {
          class: { select: { id: true, name: true, level: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
      }),
    ]);
    return {
      classTeacherOf: classTeacherOf.map((k) => ({ ...k, studentCount: k._count.students, _count: undefined })),
      teaching,
    };
  }
}
