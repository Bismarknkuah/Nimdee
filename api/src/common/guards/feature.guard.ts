import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE } from '../decorators';
import { ctx } from '../context/request-context';
import { TenantCacheService } from '../../tenants/tenant-cache.service';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tenants: TenantCacheService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<string>(FEATURE, [context.getHandler(), context.getClass()]);
    if (!feature) return true;
    const c = ctx();
    if (!c.tenantId) return true;
    const snap = await this.tenants.get(c.tenantId);
    if (!snap?.features.includes(feature)) {
      throw new ForbiddenException({
        code: 'FEATURE_NOT_IN_PLAN',
        message: `The ${feature.replace('_', ' ').toLowerCase()} module is not included in your current plan.`,
      });
    }
    return true;
  }
}
