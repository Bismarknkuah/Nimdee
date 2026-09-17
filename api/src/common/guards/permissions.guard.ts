import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS, PERMISSIONS_ANY } from '../decorators';
import { ctx, hasPermission } from '../context/request-context';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const perms = ctx().permissions ?? [];
    const anyOf = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_ANY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (anyOf?.length && !anyOf.some((p) => hasPermission(perms, p))) {
      throw new ForbiddenException({ code: 'PERMISSION_DENIED', message: `Requires one of: ${anyOf.join(', ')}` });
    }
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const missing = required.filter((p) => !hasPermission(perms, p));
    if (missing.length)
      throw new ForbiddenException({ code: 'PERMISSION_DENIED', message: `Missing permission: ${missing.join(', ')}` });
    return true;
  }
}
