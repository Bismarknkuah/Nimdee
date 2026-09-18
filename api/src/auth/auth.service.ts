import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { ctx } from '../common/context/request-context';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, PlatformLoginDto, ResetPasswordDto } from './dto';
import { ProvidersService } from '../communications/providers.service';
import { templates } from '../communications/templates';
import { randomToken } from '../common/utils';
import { JwtPayload } from './jwt.strategy';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
    private tenants: TenantCacheService,
    private providers: ProvidersService,
  ) {}

  private tenantBranding(t: any) {
    return {
      id: t.id,
      code: t.code,
      slug: t.slug,
      name: t.name,
      status: t.status,
      logoUrl: t.logoUrl,
      primaryColor: t.primaryColor,
      secondaryColor: t.secondaryColor,
      fontFamily: t.fontFamily,
      currency: t.currency,
      timezone: t.timezone,
    };
  }

  async login(dto: LoginDto) {
    const key = dto.school.trim();
    const tenant = await this.prisma.platform.tenant.findFirst({
      where: { OR: [{ slug: key.toLowerCase() }, { code: key.toUpperCase() }] },
    });
    if (!tenant) throw new UnauthorizedException('School not found. Check the school code or address.');
    if (tenant.status === 'REJECTED') throw new UnauthorizedException('This school registration was rejected.');
    const db = this.prisma.forTenant(tenant.id);
    const user = await db.user.findFirst({
      where: { email: dto.email.trim().toLowerCase() },
      include: { roles: { include: { role: true } } },
    });
    if (!user || !user.isActive || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.audit.log({
        action: 'AUTH_LOGIN_FAILED',
        entity: 'User',
        tenantId: tenant.id,
        actorName: dto.email,
        actorType: 'TENANT',
      });
      throw new UnauthorizedException('Invalid email or password');
    }
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.issueTokens(
      { sub: user.id, typ: 'TENANT', tid: tenant.id, name: `${user.firstName} ${user.lastName}` },
      tenant.id,
      dto.deviceName,
    );
    await this.audit.log({
      action: 'AUTH_LOGIN',
      entity: 'User',
      entityId: user.id,
      tenantId: tenant.id,
      actorId: user.id,
      actorName: `${user.firstName} ${user.lastName}`,
      actorType: 'TENANT',
    });
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        mustChangePassword: user.mustChangePassword,
        roles: user.roles.map((r) => r.role.name),
      },
      tenant: this.tenantBranding(tenant),
    };
  }

  async platformLogin(dto: PlatformLoginDto) {
    const user = await this.prisma.platform.platformUser.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!user || !user.isActive || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.audit.log({
        action: 'PLATFORM_LOGIN_FAILED',
        entity: 'PlatformUser',
        tenantId: null,
        actorName: dto.email,
        actorType: 'PLATFORM',
      });
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.prisma.platform.platformUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.issueTokens({ sub: user.id, typ: 'PLATFORM', name: user.name }, null);
    await this.audit.log({
      action: 'PLATFORM_LOGIN',
      entity: 'PlatformUser',
      entityId: user.id,
      tenantId: null,
      actorId: user.id,
      actorName: user.name,
      actorType: 'PLATFORM',
    });
    return { ...tokens, user: { id: user.id, email: user.email, name: user.name, role: user.role, type: 'PLATFORM' } };
  }

  async issueTokens(payload: JwtPayload, tenantId: string | null, deviceName?: string) {
    const accessTtl = process.env.JWT_ACCESS_TTL || '15m';
    const refreshTtl = process.env.JWT_REFRESH_TTL || '7d';
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_SECRET || 'dev-access-secret',
      expiresIn: accessTtl,
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: payload.sub, typ: payload.typ, tid: payload.tid, jti: randomUUID() },
      { secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret', expiresIn: refreshTtl },
    );
    const decodedRefresh: any = this.jwt.decode(refreshToken);
    const decodedAccess: any = this.jwt.decode(accessToken);
    await this.prisma.platform.refreshToken.create({
      data: {
        tenantId,
        userId: payload.sub,
        actorType: payload.typ,
        tokenHash: sha256(refreshToken),
        deviceId: deviceName?.slice(0, 80),
        expiresAt: new Date(decodedRefresh.exp * 1000),
      },
    });
    return { accessToken, refreshToken, accessExpiresAt: new Date(decodedAccess.exp * 1000).toISOString() };
  }

  /** Short-lived, audited token that lets a platform admin act inside a school for support. */
  async supportSessionToken(tenantId: string, platformUserName: string, reason: string) {
    const db = this.prisma.forTenant(tenantId);
    const admin =
      (await db.user.findFirst({ where: { isActive: true, roles: { some: { role: { name: 'School Admin' } } } } })) ??
      (await db.user.findFirst({ where: { isActive: true, userType: 'STAFF' } }));
    if (!admin) throw new BadRequestException('This school has no active staff account to attach a support session to');
    const token = await this.jwt.signAsync(
      {
        sub: admin.id,
        typ: 'TENANT',
        tid: tenantId,
        sup: true,
        supBy: platformUserName,
        name: `Support: ${platformUserName}`,
      } as JwtPayload,
      { secret: process.env.JWT_SECRET || 'dev-access-secret', expiresIn: '30m' },
    );
    await this.audit.log({ action: 'SUPPORT_SESSION_STARTED', entity: 'Tenant', entityId: tenantId, tenantId, reason });
    return { accessToken: token, expiresInMinutes: 30, actingAs: `${admin.firstName} ${admin.lastName}` };
  }

  async refresh(token: string) {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret' });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const row = await this.prisma.platform.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.revokedAt || row.expiresAt < new Date())
      throw new UnauthorizedException('Refresh token expired or revoked');
    await this.prisma.platform.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    if (payload.typ === 'PLATFORM') {
      const u = await this.prisma.platform.platformUser.findUnique({ where: { id: payload.sub } });
      if (!u?.isActive) throw new UnauthorizedException('Account disabled');
      return this.issueTokens({ sub: u.id, typ: 'PLATFORM', name: u.name }, null, row.deviceId ?? undefined);
    }
    const u = await this.prisma.forTenant(payload.tid).user.findUnique({ where: { id: payload.sub } });
    if (!u?.isActive) throw new UnauthorizedException('Account disabled');
    return this.issueTokens(
      { sub: u.id, typ: 'TENANT', tid: payload.tid, name: `${u.firstName} ${u.lastName}` },
      payload.tid,
      row.deviceId ?? undefined,
    );
  }

  async logout(token?: string) {
    if (token) {
      await this.prisma.platform.refreshToken.updateMany({
        where: { tokenHash: sha256(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { ok: true };
  }

  async me() {
    const c = ctx();
    if (c.actorType === 'PLATFORM') {
      const u = await this.prisma.platform.platformUser.findUnique({ where: { id: c.userId } });
      return { type: 'PLATFORM', user: { id: u.id, email: u.email, name: u.name, role: u.role }, permissions: ['*'] };
    }
    const db = this.prisma.db;
    const [user, snap, tenant] = await Promise.all([
      db.user.findUnique({
        where: { id: c.userId },
        include: {
          roles: { include: { role: { select: { id: true, name: true } } } },
          staff: { select: { id: true, employeeId: true } },
          guardian: { select: { id: true } },
          student: { select: { id: true, studentId: true, classId: true } },
        },
      }),
      this.tenants.get(c.tenantId),
      this.prisma.platform.tenant.findUnique({ where: { id: c.tenantId } }),
    ]);
    return {
      type: 'TENANT',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        userType: user.userType,
        mustChangePassword: user.mustChangePassword,
        avatarUrl: user.avatarUrl,
      },
      roles: user.roles.map((r) => r.role.name),
      permissions: c.permissions,
      isSupportSession: !!c.isSupportSession,
      links: {
        staffId: user.staff?.id ?? null,
        guardianId: user.guardian?.id ?? null,
        studentId: user.student?.id ?? null,
      },
      tenant: {
        ...this.tenantBranding(tenant),
        settings: snap.settings,
        country: tenant.country,
        region: tenant.region,
        address: tenant.address,
        phone: tenant.phone,
        email: tenant.email,
      },
      features: snap.features,
      subscription: {
        status: snap.subscriptionStatus,
        planCode: snap.planCode,
        planName: snap.planName,
        studentLimit: snap.studentLimit,
        currentPeriodEnd: snap.currentPeriodEnd,
        trialEndsAt: snap.trialEndsAt,
      },
    };
  }

  async changePassword(dto: ChangePasswordDto) {
    const c = ctx();
    if (c.actorType === 'PLATFORM') {
      const u = await this.prisma.platform.platformUser.findUnique({ where: { id: c.userId } });
      if (!(await bcrypt.compare(dto.currentPassword, u.passwordHash)))
        throw new BadRequestException('Current password is incorrect');
      await this.prisma.platform.platformUser.update({
        where: { id: u.id },
        data: { passwordHash: await bcrypt.hash(dto.newPassword, 10) },
      });
      return { ok: true };
    }
    if (c.isSupportSession) throw new BadRequestException('Support sessions cannot change passwords');
    const u = await this.prisma.db.user.findUnique({ where: { id: c.userId } });
    if (!(await bcrypt.compare(dto.currentPassword, u.passwordHash)))
      throw new BadRequestException('Current password is incorrect');
    await this.prisma.db.user.update({
      where: { id: u.id },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 10), mustChangePassword: false },
    });
    await this.prisma.platform.refreshToken.updateMany({
      where: { userId: u.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({ action: 'PASSWORD_CHANGED', entity: 'User', entityId: u.id });
    return { ok: true };
  }

  // ─────────────────────────── Password reset ───────────────────────────
  /** Always responds identically so the endpoint cannot be used to discover accounts. */
  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const minutes = 30;
    let user: { id: string; name: string; tenantId: string | null; actorType: 'TENANT' | 'PLATFORM' } | null = null;
    let brand: any = { name: 'Nimdee' };
    if (dto.school) {
      const tenant = await this.prisma.platform.tenant.findFirst({
        where: { OR: [{ slug: dto.school.trim().toLowerCase() }, { code: dto.school.trim().toUpperCase() }] },
      });
      if (tenant) {
        const u = await this.prisma.forTenant(tenant.id).user.findFirst({ where: { email, isActive: true } });
        if (u) {
          user = { id: u.id, name: `${u.firstName} ${u.lastName}`, tenantId: tenant.id, actorType: 'TENANT' };
          brand = { name: tenant.name, primaryColor: tenant.primaryColor, logoUrl: tenant.logoUrl };
        }
      }
    } else {
      const u = await this.prisma.platform.platformUser.findFirst({ where: { email, isActive: true } });
      if (u) user = { id: u.id, name: u.name, tenantId: null, actorType: 'PLATFORM' };
    }
    if (user) {
      const token = randomToken(32);
      await this.prisma.platform.passwordResetToken.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          actorType: user.actorType,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + minutes * 60_000),
        },
      });
      const url = `${process.env.WEB_APP_URL ?? ''}${user.actorType === 'PLATFORM' ? '/platform' : ''}/reset-password?token=${token}${dto.school ? `&school=${encodeURIComponent(dto.school)}` : ''}`;
      const t = templates.passwordReset(brand, { name: user.name, url, minutes });
      await this.providers.sendEmail([email], t.subject, t.text, t.html);
      await this.audit.log({
        action: 'PASSWORD_RESET_REQUESTED',
        entity: user.actorType === 'PLATFORM' ? 'PlatformUser' : 'User',
        entityId: user.id,
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: email,
        actorType: user.actorType,
      });
    }
    return { ok: true, message: 'If an account exists for that email, a reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const row = await this.prisma.platform.passwordResetToken.findUnique({ where: { tokenHash: sha256(dto.token) } });
    if (!row || row.usedAt || row.expiresAt < new Date())
      throw new BadRequestException('This reset link is invalid or has expired. Request a new one.');
    const hash = await bcrypt.hash(dto.password, 10);
    if (row.actorType === 'PLATFORM')
      await this.prisma.platform.platformUser.update({ where: { id: row.userId }, data: { passwordHash: hash } });
    else
      await this.prisma
        .forTenant(row.tenantId!)
        .user.update({ where: { id: row.userId }, data: { passwordHash: hash, mustChangePassword: false } });
    await this.prisma.platform.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    await this.prisma.platform.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      action: 'PASSWORD_RESET_COMPLETED',
      entity: row.actorType === 'PLATFORM' ? 'PlatformUser' : 'User',
      entityId: row.userId,
      tenantId: row.tenantId,
      actorId: row.userId,
      actorName: 'password reset',
      actorType: row.actorType as any,
    });
    return { ok: true };
  }

  // ─────────────────────────── Sessions ───────────────────────────
  async sessions() {
    const c = ctx();
    const rows = await this.prisma.platform.refreshToken.findMany({
      where: { userId: c.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, deviceId: true, createdAt: true, expiresAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      device: r.deviceId ?? 'Unknown device',
      signedInAt: r.createdAt,
      expiresAt: r.expiresAt,
    }));
  }

  async revokeSession(id: string) {
    await this.prisma.platform.refreshToken.updateMany({
      where: { id, userId: ctx().userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async revokeAllSessions() {
    const r = await this.prisma.platform.refreshToken.updateMany({
      where: { userId: ctx().userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      action: 'SESSIONS_REVOKED',
      entity: 'User',
      entityId: ctx().userId,
      after: { count: r.count },
    });
    return { revoked: r.count };
  }
}
