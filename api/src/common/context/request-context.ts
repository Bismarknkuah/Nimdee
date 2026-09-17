import { AsyncLocalStorage } from 'async_hooks';
import { ForbiddenException } from '@nestjs/common';

export type ActorType = 'PLATFORM' | 'TENANT' | 'SYSTEM';

export interface RequestContext {
  requestId?: string;
  ip?: string;
  userAgent?: string;
  tenantId?: string;
  userId?: string;
  userType?: string;
  actorType?: ActorType;
  actorName?: string;
  permissions?: string[];
  isSupportSession?: boolean;
  staffId?: string;
  guardianId?: string;
  studentId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/** Current request context (empty object outside of a request). */
export function ctx(): RequestContext {
  return requestContext.getStore() ?? {};
}

/** Tenant id of the current request. Throws if the request is not tenant-scoped. */
export function tid(): string {
  const t = ctx().tenantId;
  if (!t) throw new ForbiddenException('Tenant context is required');
  return t;
}

export function hasPermission(permissions: string[] | undefined, perm: string): boolean {
  if (!permissions) return false;
  return permissions.includes('*') || permissions.includes(perm);
}
