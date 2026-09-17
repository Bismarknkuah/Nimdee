# Security model

## Tenant isolation (defence in depth)

1. **Application scoping** — every request runs inside an `AsyncLocalStorage` context that carries the tenant id; `PrismaService.db` sets `app.tenant_id` in a transaction before each query.
2. **Database enforcement** — PostgreSQL Row-Level Security is `ENABLE`d **and** `FORCE`d on all 69 tenant tables (including `Tenant` itself, by id). The policy is `tenantId = current_setting('app.tenant_id', true)`. The migration creates a non-superuser role `schoolos_app`; the connection pool executes `SET ROLE schoolos_app` on connect because superusers bypass RLS. Verified by the smoke suite: a second school sees zero rows and cannot insert into another school even with known ids.
3. **Platform paths** use the unscoped client only behind `@PlatformOnly()` and are audited.

## Authentication

* Bcrypt (cost 10) password hashes; temporary passwords are shown once and must be changed.
* JWT access tokens (15 minutes) carry user id, tenant, permissions and links (staff/guardian/student ids).
* Refresh tokens (30 days) are random, stored hashed, rotated on every use and revoked on reuse (token-family compromise detection). Logout revokes the family.
* Password reset tokens are single-use and time-limited.
* Platform support sessions mint a short-lived token that acts as the school admin; the session is written to the audit log with a mandatory reason and appears in the school's own audit log.

## Authorisation

* Roles hold a JSON list of permissions; `*` means all. The catalogue is in `common/permissions.ts`.
* `@RequirePermissions(a, b)` requires all; `@RequireAnyPermission(a, b)` requires one.
* `FeatureGuard` blocks modules that are not in the school's plan (`FEATURE_NOT_IN_PLAN`), so an expired or downgraded plan degrades gracefully.
* Teachers are restricted to their own classes (class teacher or subject teacher) for attendance, marks, assignments, discipline and messaging; parents to their own children; students to themselves.
* Health records require dedicated clinic permissions; payslips are visible to the owner and payroll managers only.

## Data protection

* Money is stored as `DECIMAL(12,2)` and moved only through the append-only ledger; payments can be reversed, never edited.
* Sensitive columns are never serialised (`passwordHash`, token hashes, Paystack keys) — the `SerializeInterceptor` strips them and the data export redacts them.
* ID cards embed an HMAC-signed payload (`SOS1|schoolCode|studentId|signature`); `POST /students/verify-qr` validates it.
* Payment webhooks are verified with HMAC-SHA512; unsigned or mismatched events are rejected and logged.
* Audit log entries (`AuditLog`) are insert-only and record actor, action, entity, before/after, IP and request id.

## Transport & platform hardening

* `helmet`, CORS allow-list with wildcard subdomains, rate limiting (`@nestjs/throttler`), body size limits, request ids.
* Secrets only via environment variables; `.env` files are git-ignored.
* Recommended: enable Railway private networking between API and database, rotate `JWT_*` secrets on staff changes, restrict platform accounts to hardware-key protected mailboxes.
