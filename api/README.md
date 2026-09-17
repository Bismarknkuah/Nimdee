# School OS API (NestJS · Prisma · PostgreSQL)

REST API at `/api/v1` — Swagger UI at `/docs`, OpenAPI JSON at `/docs-json` (copy in `docs/openapi.json`), health at `/health`.

## Commands
| Command | What it does |
|---|---|
| `npm run start:dev` | dev server with reload |
| `npm run build` / `npm run start:prod` | production build; start runs `prisma migrate deploy` first |
| `npx prisma migrate deploy` | apply `prisma/migrations` (schema + Row-Level Security + app role) |
| `npm run seed` | platform owner, plans and the "Bright Future Academy" demo school (32 students, staff, fees, results, canteen, incidents, events, homework, library, transport, clinic, messages, leave, payroll) |
| `npm test` | 26 unit tests (money, grading, installments, rules validation, permission guard) |
| `npm run smoke` | 233 end-to-end checks against a running API (`API_URL`, default http://localhost:4000) |
| `npm run format` | Prettier |
| `node scripts/gen-docs.js` | regenerate `docs/ERD.md` and `docs/API.md` |

## Request pipeline
`contextMiddleware` (AsyncLocalStorage request context) → `ThrottlerGuard` → `JwtAuthGuard` (`@Public()` to skip) → `TenantGuard` (blocks PENDING/SUSPENDED schools; `@PlatformOnly()` / `@AllowInactiveTenant()`) → `PermissionsGuard` (`@RequirePermissions()` all-of, `@RequireAnyPermission()` one-of) → `FeatureGuard` (`@RequireFeature()`, plan flags + overrides) → controller → `SerializeInterceptor` (Decimal → number, secrets stripped) / `HttpExceptionFilter`.

Inside services use `this.prisma.db` (tenant-scoped, RLS-enforced), `this.prisma.tenantTx(fn)` for transactions, and `this.prisma.platform` only in platform-owner code paths.

## Modules (src/)
auth · platform · tenants · schools · users · academic · students · staff · attendance · sync · fees · results · timetable · canteen · inventory · communications · admissions · dashboard · portal · exports · public · subscriptions · data (full export) · analytics · discipline · events · assignments · library · transport · health · messaging · hr · reports · pdf (documents) · audit · notifications · providers · common (guards, decorators, context, settings, permissions, features, utils).

## Data model
73 models — see `../docs/ERD.md`. Every tenant table carries `tenantId` and is protected by RLS (`ENABLE` + `FORCE`); `Sequence` produces atomic human-readable IDs (`STD-2026-000001`, `INV-…`, `RCP-…`, `EMP-…`).

## Notes
* Migrations were generated for PostgreSQL and verified; `prisma migrate deploy` applies them unchanged on Railway.
* `PRISMA_ENGINE=wasm` + `scripts/enable-wasm-engine.js` exist only for sandboxes that cannot download Prisma's native engine. Never use in production.
* SMS/email default to `LOG` providers so every flow works without credentials.
