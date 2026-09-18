import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_ANY_ACTOR, ALLOW_INACTIVE_TENANT, IS_PUBLIC, PLATFORM_ONLY } from '../decorators';
import { ctx } from '../context/request-context';
import { TenantCacheService } from '../../tenants/tenant-cache.service';

/**
 * Separates the platform admin environment from school environments and enforces school status.
 * Platform users can only reach @PlatformOnly routes; school users can never reach them.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tenants: TenantCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_ANY_ACTOR, targets)) return true;
    const platformOnly = this.reflector.getAllAndOverride<boolean>(PLATFORM_ONLY, targets);
    const c = ctx();
    if (platformOnly) {
      if (c.actorType !== 'PLATFORM') throw new ForbiddenException('Platform administrators only');
      return true;
    }
    if (c.actorType === 'PLATFORM')
      throw new ForbiddenException(
        'Platform accounts cannot access school data directly. Start an audited support session instead.',
      );
    if (!c.tenantId) throw new ForbiddenException('Tenant context is required');
    const snap = await this.tenants.get(c.tenantId);
    if (!snap) throw new ForbiddenException('School not found');
    if (snap.status !== 'ACTIVE' && !this.reflector.getAllAndOverride<boolean>(ALLOW_INACTIVE_TENANT, targets)) {
      const messages: Record<string, string> = {
        PENDING: 'Your school is awaiting approval by the platform administrator.',
        SUSPENDED:
          'This school account is suspended. Please contact support or settle outstanding subscription invoices.',
        REJECTED: 'This school registration was rejected.',
      };
      throw new ForbiddenException({
        code: `TENANT_${snap.status}`,
        message: messages[snap.status] ?? 'School inactive',
      });
    }
    return true;
  }
}
