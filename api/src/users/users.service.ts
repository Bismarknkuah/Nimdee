import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ctx, tid } from '../common/context/request-context';
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from '../common/permissions';
import { paginate, randomPassword } from '../common/utils';
import { ProvidersService } from '../communications/providers.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { templates } from '../communications/templates';
import { CreateUserDto, ListUsersDto, RoleDto, UpdateMyProfileDto, UpdateUserDto } from './dto';

export interface NewLogin {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  userType: 'STAFF' | 'TEACHER' | 'PARENT' | 'STUDENT';
  roleNames?: string[];
  roleIds?: string[];
  password?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private providers: ProvidersService,
    private tenants: TenantCacheService,
  ) {}

  /**
   * Creates a login account with roles. Works inside a transaction (pass tx) or standalone.
   * Returns the temporary password so it can be handed to the person (it is never stored in clear).
   */
  async createLogin(db: any, data: NewLogin) {
    const tenantId = tid();
    const email = data.email.trim().toLowerCase();
    const existing = await db.user.findFirst({ where: { tenantId, email } });
    if (existing) throw new ConflictException(`A login already exists for ${email}`);
    let roleIds = data.roleIds ?? [];
    if (data.roleNames?.length) {
      const roles = await db.role.findMany({ where: { tenantId, name: { in: data.roleNames } } });
      roleIds = [...roleIds, ...roles.map((r: any) => r.id)];
    }
    const temporaryPassword = data.password ?? randomPassword();
    const user = await db.user.create({
      data: {
        tenantId,
        email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone ?? null,
        userType: data.userType,
        passwordHash: await bcrypt.hash(temporaryPassword, 10),
        mustChangePassword: !data.password,
        roles: { create: [...new Set(roleIds)].map((roleId) => ({ tenantId, roleId })) },
      },
      include: { roles: { include: { role: { select: { id: true, name: true } } } } },
    });
    if (!data.password)
      this.sendWelcome(email, `${data.firstName} ${data.lastName}`, temporaryPassword).catch(() => undefined);
    return { user, temporaryPassword: data.password ? undefined : temporaryPassword };
  }

  /** Welcome email with the temporary password (best-effort; the password is also shown once on screen). */
  private async sendWelcome(email: string, name: string, temporaryPassword: string) {
    if (email.endsWith('.student')) return;
    const snap = await this.tenants.get(tid());
    if (!snap || snap.settings.communication.emailEnabled === false) return;
    const t = templates.welcomeUser(
      { name: snap.name, primaryColor: snap.primaryColor, logoUrl: snap.logoUrl },
      { name, email, temporaryPassword, school: snap.slug, loginUrl: `${process.env.WEB_APP_URL ?? ''}/login` },
    );
    await this.providers.sendEmail([email], t.subject, t.text, t.html);
  }

  async list(q: ListUsersDto) {
    const { skip, take, page, pageSize } = paginate(q.page, q.pageSize);
    const where: any = {};
    if (q.userType) where.userType = q.userType;
    if (q.roleId) where.roles = { some: { roleId: q.roleId } };
    if (q.isActive === 'true' || q.isActive === 'false') where.isActive = q.isActive === 'true';
    if (q.search)
      where.OR = [
        { firstName: { contains: q.search, mode: 'insensitive' } },
        { lastName: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ];
    const [items, total] = await Promise.all([
      this.prisma.db.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { roles: { include: { role: { select: { id: true, name: true } } } } },
      }),
      this.prisma.db.user.count({ where }),
    ]);
    return { items: items.map((u) => ({ ...u, roles: u.roles.map((r) => r.role) })), total, page, pageSize };
  }

  async create(dto: CreateUserDto) {
    const { user, temporaryPassword } = await this.createLogin(this.prisma.db, {
      ...dto,
      userType: dto.userType ?? 'STAFF',
    });
    await this.audit.log({
      action: 'USER_CREATED',
      entity: 'User',
      entityId: user.id,
      after: { email: user.email, roles: user.roles.map((r) => r.role.name) },
    });
    return { ...user, roles: user.roles.map((r) => r.role), temporaryPassword };
  }

  /** Any signed-in user (platform or tenant) updating their own name, phone or avatar. */
  async updateMe(dto: UpdateMyProfileDto) {
    const c = ctx();
    if (c.actorType === 'PLATFORM') {
      const u = await this.prisma.platform.platformUser.update({
        where: { id: c.userId },
        data: {
          name: dto.name?.trim() || undefined,
          avatarUrl: dto.avatarUrl === '' ? null : dto.avatarUrl,
        },
      });
      return { id: u.id, email: u.email, name: u.name, role: u.role, avatarUrl: u.avatarUrl };
    }
    const u = await this.prisma.db.user.update({
      where: { id: c.userId },
      data: {
        firstName: dto.firstName?.trim() || undefined,
        lastName: dto.lastName?.trim() || undefined,
        phone: dto.phone === '' ? null : dto.phone,
        avatarUrl: dto.avatarUrl === '' ? null : dto.avatarUrl,
      },
    });
    await this.audit.log({ action: 'PROFILE_UPDATED', entity: 'User', entityId: u.id, after: dto });
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      avatarUrl: u.avatarUrl,
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const db = this.prisma.db;
    const before = await db.user.findUnique({ where: { id }, include: { roles: true } });
    if (!before) throw new NotFoundException('User not found');
    if (dto.isActive === false && id === ctx().userId)
      throw new BadRequestException('You cannot deactivate your own account');
    const { roleIds, ...rest } = dto;
    const data: any = { ...rest };
    if (rest.email) data.email = rest.email.trim().toLowerCase();
    if (roleIds) {
      if (id === ctx().userId && !ctx().permissions?.includes('*'))
        throw new BadRequestException('You cannot change your own roles');
      data.roles = { deleteMany: {}, create: [...new Set(roleIds)].map((roleId) => ({ tenantId: tid(), roleId })) };
    }
    const user = await db.user.update({
      where: { id },
      data,
      include: { roles: { include: { role: { select: { id: true, name: true } } } } },
    });
    if (dto.isActive === false)
      await this.prisma.platform.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    await this.audit.log({
      action: 'USER_UPDATED',
      entity: 'User',
      entityId: id,
      before: { isActive: before.isActive, roles: before.roles.map((r) => r.roleId) },
      after: { ...rest, roleIds },
    });
    return { ...user, roles: user.roles.map((r) => r.role) };
  }

  async resetPassword(id: string) {
    const temporaryPassword = randomPassword();
    await this.prisma.db.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(temporaryPassword, 10), mustChangePassword: true },
    });
    await this.prisma.platform.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({ action: 'USER_PASSWORD_RESET', entity: 'User', entityId: id });
    return { temporaryPassword };
  }

  // ── Roles ──
  permissionCatalog() {
    return { groups: PERMISSION_GROUPS, all: ALL_PERMISSIONS };
  }

  async roles() {
    const roles = await this.prisma.db.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { users: true } } },
    });
    return roles.map((r) => ({ ...r, userCount: r._count.users, _count: undefined }));
  }

  private validatePermissions(perms: string[]) {
    const bad = perms.filter((p) => p !== '*' && !ALL_PERMISSIONS.includes(p));
    if (bad.length) throw new BadRequestException(`Unknown permissions: ${bad.join(', ')}`);
  }

  async createRole(dto: RoleDto) {
    this.validatePermissions(dto.permissions);
    const role = await this.prisma.db.role.create({
      data: {
        tenantId: tid(),
        name: dto.name.trim(),
        description: dto.description,
        permissions: [...new Set(dto.permissions)],
      },
    });
    await this.audit.log({ action: 'ROLE_CREATED', entity: 'Role', entityId: role.id, after: role });
    return role;
  }

  async updateRole(id: string, dto: Partial<RoleDto>) {
    const role = await this.prisma.db.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (dto.permissions) this.validatePermissions(dto.permissions);
    if (role.isSystem && role.name === 'School Admin')
      throw new BadRequestException('The School Admin role cannot be modified');
    const updated = await this.prisma.db.role.update({
      where: { id },
      data: {
        name: role.isSystem ? undefined : dto.name?.trim(),
        description: dto.description,
        permissions: dto.permissions ? [...new Set(dto.permissions)] : undefined,
      },
    });
    await this.audit.log({ action: 'ROLE_UPDATED', entity: 'Role', entityId: id, before: role, after: updated });
    return updated;
  }

  async deleteRole(id: string) {
    const role = await this.prisma.db.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new BadRequestException('System roles cannot be deleted');
    if (role._count.users > 0) throw new BadRequestException(`Role is assigned to ${role._count.users} user(s)`);
    await this.prisma.db.role.delete({ where: { id } });
    await this.audit.log({ action: 'ROLE_DELETED', entity: 'Role', entityId: id, before: role });
    return { ok: true };
  }
}
