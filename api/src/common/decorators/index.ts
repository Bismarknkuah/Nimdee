import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
export const PLATFORM_ONLY = 'platformOnly';
export const PERMISSIONS = 'permissions';
export const FEATURE = 'feature';
export const ALLOW_INACTIVE_TENANT = 'allowInactiveTenant';
export const ALLOW_ANY_ACTOR = 'allowAnyActor';

/** Skips authentication entirely. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Route is reserved for platform (SaaS owner) administrators. */
export const PlatformOnly = () => SetMetadata(PLATFORM_ONLY, true);
/** Caller must hold ALL listed permissions (or the wildcard "*"). */
export const RequirePermissions = (...perms: string[]) => SetMetadata(PERMISSIONS, perms);
export const PERMISSIONS_ANY = 'permissions:any';
/** Passes when the caller holds at least ONE of the listed permissions (RequirePermissions requires all). */
export const RequireAnyPermission = (...perms: string[]) => SetMetadata(PERMISSIONS_ANY, perms);
/** Tenant's plan must include the feature. */
export const RequireFeature = (feature: string) => SetMetadata(FEATURE, feature);
/** Route stays reachable while the school is PENDING/SUSPENDED (e.g. billing, profile). */
export const AllowInactiveTenant = () => SetMetadata(ALLOW_INACTIVE_TENANT, true);
/**
 * Own-account routes (profile, change password, active sessions) that make sense for both a school
 * user and a platform user, and whose service method already branches on actor type itself. Without
 * this, TenantGuard's default rule ("platform accounts cannot access school data") wrongly blocks a
 * platform admin from calling something as basic as /auth/me right after logging in.
 */
export const AllowAnyActor = () => SetMetadata(ALLOW_ANY_ACTOR, true);

export const CurrentUser = createParamDecorator((data: string | undefined, ec: ExecutionContext) => {
  const user = ec.switchToHttp().getRequest().user;
  return data ? user?.[data] : user;
});
