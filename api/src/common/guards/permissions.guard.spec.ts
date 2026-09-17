import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { requestContext } from '../context/request-context';
import { PERMISSIONS, PERMISSIONS_ANY } from '../decorators';
import { PermissionsGuard } from './permissions.guard';

function contextWith(meta: Record<string, string[] | undefined>) {
  const reflector = { getAllAndOverride: (key: string) => meta[key] } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);
  const ctx = { getHandler: () => ({}), getClass: () => ({}) } as any;
  return (perms: string[]) => requestContext.run({ permissions: perms } as any, () => guard.canActivate(ctx));
}

describe('PermissionsGuard', () => {
  it('allows when no permission metadata is present', () => {
    expect(contextWith({})([])).toBe(true);
  });
  it('requires every listed permission for RequirePermissions', () => {
    const run = contextWith({ [PERMISSIONS]: ['FEES_VIEW', 'PAYMENT_RECORD'] });
    expect(run(['FEES_VIEW', 'PAYMENT_RECORD'])).toBe(true);
    expect(() => run(['FEES_VIEW'])).toThrow(ForbiddenException);
  });
  it('wildcard grants everything', () => {
    expect(contextWith({ [PERMISSIONS]: ['USERS_MANAGE'] })(['*'])).toBe(true);
  });
  it('RequireAnyPermission passes with one match and fails with none', () => {
    const run = contextWith({ [PERMISSIONS_ANY]: ['LEAVE_REQUEST', 'HR_MANAGE'] });
    expect(run(['LEAVE_REQUEST'])).toBe(true);
    expect(() => run(['STUDENT_VIEW'])).toThrow(/Requires one of/);
  });
});
