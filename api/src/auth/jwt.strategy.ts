import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { requestContext } from '../common/context/request-context';

export interface JwtPayload {
  sub: string;
  typ: 'TENANT' | 'PLATFORM';
  tid?: string;
  name?: string;
  /** Audited platform support session acting inside a school */
  sup?: boolean;
  supBy?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-access-secret',
    });
  }

  async validate(payload: JwtPayload) {
    const store = requestContext.getStore() ?? {};
    if (payload.typ === 'PLATFORM') {
      const user = await this.prisma.platform.platformUser.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) throw new UnauthorizedException('Account disabled');
      Object.assign(store, { userId: user.id, actorType: 'PLATFORM', actorName: user.name, permissions: ['*'] });
      return { id: user.id, type: 'PLATFORM', email: user.email, name: user.name, role: user.role };
    }
    if (!payload.tid) throw new UnauthorizedException();
    const user = await this.prisma.forTenant(payload.tid).user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: { include: { role: { select: { name: true, permissions: true } } } },
        staff: { select: { id: true } },
        guardian: { select: { id: true } },
        student: { select: { id: true } },
      },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Account disabled');
    const permissions = payload.sup ? ['*'] : [...new Set(user.roles.flatMap((r) => r.role.permissions))];
    Object.assign(store, {
      tenantId: payload.tid,
      userId: user.id,
      userType: user.userType,
      actorType: 'TENANT',
      actorName: payload.sup
        ? `${payload.supBy} via ${user.firstName} ${user.lastName}`
        : `${user.firstName} ${user.lastName}`,
      permissions,
      isSupportSession: !!payload.sup,
      staffId: user.staff?.id,
      guardianId: user.guardian?.id,
      studentId: user.student?.id,
    });
    return {
      id: user.id,
      type: 'TENANT',
      tenantId: payload.tid,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      roles: user.roles.map((r) => r.role.name),
      permissions,
      isSupportSession: !!payload.sup,
      staffId: user.staff?.id,
      guardianId: user.guardian?.id,
      studentId: user.student?.id,
    };
  }
}
