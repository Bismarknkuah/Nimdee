# Architecture

School OS is a multi-tenant SaaS: one deployment serves every school, and every school's data is isolated at the database layer.

```
                     ┌────────────────────────────┐
  school.yourdomain  │  Next.js 14 (Vercel)       │   ┌──────────────────────────┐
  parent.yourdomain ─┤  web/  App Router, PWA,    ├──▶│  NestJS 10 API (Railway)  │
  custom domains     │  offline queue (IndexedDB) │   │  api/  /api/v1, /docs     │
                     └────────────────────────────┘   └────────────┬─────────────┘
                                                                   │ Prisma + pg pool
                                                                   ▼
                                                      ┌──────────────────────────┐
                                                      │ PostgreSQL               │
                                                      │ 73 tables, RLS on 69     │
                                                      └──────────────────────────┘
```

## Backend (`api/`)

* **Framework**: NestJS 10, TypeScript strict-ish, class-validator DTOs, Swagger on `/docs`.
* **Data**: Prisma 5 with the `driverAdapters` preview feature and the `pg` pool adapter. The pool executes `SET ROLE schoolos_app` on every connection so the API never runs as a superuser (superusers bypass Row-Level Security).
* **Request pipeline**: `contextMiddleware` creates an `AsyncLocalStorage` request context (request id, tenant, user, permissions, actor name) → `ThrottlerGuard` → `JwtAuthGuard` (`@Public()` opts out) → `TenantGuard` (blocks PENDING/SUSPENDED schools, `@PlatformOnly()` / `@AllowInactiveTenant()`) → `PermissionsGuard` (`@RequirePermissions()` = all of, `@RequireAnyPermission()` = one of) → `FeatureGuard` (`@RequireFeature()` checks the school's plan + overrides) → controller → `SerializeInterceptor` (Decimal → number, secrets stripped) / `HttpExceptionFilter` (uniform error envelope).
* **Tenant scoping**: `PrismaService.db` is a Prisma client extension that wraps every operation in a transaction which first runs `SELECT set_config('app.tenant_id', $1, true)`; RLS policies compare each row's `tenantId` to that setting. `PrismaService.platform` is the unscoped client for platform-owner code paths and is only reachable through `@PlatformOnly()` controllers. `tenantTx(fn)` gives an explicit transaction under the same scoping.
* **Modules** (one folder each under `src/`): auth, platform, tenants, schools, users, academic, students, staff, attendance, sync, fees, results, timetable, canteen, inventory, communications, admissions, dashboard, portal, exports, public, subscriptions, data (full export), analytics, discipline, events, assignments, library, transport, health, messaging, hr, reports, pdf (documents), audit, notifications, providers (SMS/email/payment gateways).
* **Cross-cutting**: `common/` holds decorators, guards, the request context, the rules-engine defaults + validation (`settings.ts`), the permission catalogue (`permissions.ts`), the plan/feature catalogue (`features.ts`), money/date utilities, and the Prisma runtime shim (`prisma-runtime.ts`) that lets the same code run on the native engine (production) or the WASM engine (restricted sandboxes).
* **Scheduled jobs** (`@nestjs/schedule`): overdue invoice flagging, subscription grace/suspension, device offline detection, library overdue marking.
* **Documents**: `pdf/pdf.service.ts` renders branded PDFs with pdfkit; `pdf/documents.controller.ts` exposes them.

## Frontend (`web/`)

* **Framework**: Next.js 14 App Router, Tailwind, lucide icons, recharts, qrcode.react.
* **Routing**: `middleware.ts` resolves the school from the host (`slug.yourdomain` or a verified custom domain), rewrites `/` to the school website and `/apply` to the admissions form, and remembers the slug for login. Everything under `/school/*` is the authenticated portal; `/platform/*` is the platform console; `/site/[slug]` is the public website.
* **State**: `lib/auth.tsx` keeps the session (access token in memory + refresh token rotation), exposes `can(...perms)`, `has(feature)`, `role`, and applies the school's branding as CSS variables (hex and RGB triplets so Tailwind opacity modifiers work). `lib/hooks.ts#useApi` is a small fetch/revalidate hook; `lib/academic.ts` caches classes/terms.
* **Offline**: `lib/offline.ts` stores a class snapshot and an operation queue in IndexedDB, registers the device, pushes the queue to `/sync/push` when online (on reconnect, every 90 s, and on demand) and surfaces conflicts. `public/sw.js` caches the app shell.
* **Dashboards**: one file per role under `app/school/dashboards/<role>/page.tsx`; `/school` redirects to the right one.
* **UI kit**: `components/ui/index.tsx` (cards, tables with pagination, modals, forms, tabs, badges, stat cards, calendar, timeline, progress bars, toasts) and `components/charts.tsx` (recharts wrappers).

## Multi-tenancy model

| Concern | Mechanism |
|---|---|
| Identification | `Tenant` row per school (code `SCH-GH-000001`, slug, domains). Users belong to exactly one tenant; platform users are separate. |
| Isolation | RLS `ENABLE` + `FORCE` on every tenant table; policy `tenantId = current_setting('app.tenant_id')`. |
| Branding | Colours/logo/font on `Tenant`, applied server-side (PDFs, website) and client-side (CSS variables). |
| Rules | `Tenant.settings` JSON (validated by `validateSettings`) drives grading, promotion, attendance thresholds, invoicing, sync conflict policy, canteen limits. |
| Plans | `Plan.features[]` + `Tenant.featureOverrides[]` → `FeatureGuard`; student limits enforced on enrolment. |
| Lifecycle | PENDING → ACTIVE → SUSPENDED (platform), TRIAL → ACTIVE → PAST_DUE → GRACE → SUSPENDED (subscription job). |

## Key flows

* **Onboarding**: `POST /public/register` creates tenant + admin + system roles + default academic year/terms + trial subscription; the platform approves (or auto-approves) → school becomes ACTIVE.
* **Attendance offline**: teacher downloads snapshot → marks offline → queue → `/sync/push` (idempotent per `opId`, versioned records) → conflicts resolved by policy or manually.
* **Fees**: fee structures → `POST /fees/invoices/generate` (discounts, sibling discount, installments) → payments (cash/MoMo/bank or Paystack) → ledger → receipts/statements.
* **Results**: assessments → marks → `POST /results/compute` (weighted CA/exam, grade bands, dense ranking, attendance, promotion) → submit → review → approve → publish → report cards/transcripts.
