# School OS — multi-tenant School Operating System

A production-grade SaaS platform for schools: one codebase, many schools, each fully isolated at the database layer, each owning and able to download its data.

| Layer | Stack | Hosting |
|---|---|---|
| `api/` | NestJS 10 · Prisma 5 · PostgreSQL (Row-Level Security) · JWT · pdfkit | **Railway** |
| `web/` | Next.js 14 (App Router) · Tailwind · IndexedDB offline queue · PWA | **Vercel** |
| `docs/` | Architecture, modules, API reference (283 endpoints), ERD, security, data ownership, offline sync, deployment, per-role user guides | — |

## What is implemented

Everything below is working end-to-end and exercised by **222 automated API checks** (`api/scripts/smoke.js`) plus **26 unit tests** (`npm test`). The frontend type-checks and builds (66 pages).

**Platform console** — school registry and approval workflow, plans and feature flags, subscription invoices and upgrades, feature overrides, audited support sessions, cross-school audit log, sync health, per-school **data export**.

**Onboarding & identity** — self-service registration, automatic subdomain, system roles (School Admin, Principal, Academic Head, Teacher, Class Teacher, Accountant, Cashier, Canteen Manager, Nurse, Librarian, HR Officer, Parent, Student) with 60+ granular permissions, custom roles, JWT + rotating refresh tokens.

**Branding, website & rules** — logo/colours/font applied everywhere (portal, website, PDFs); no-code website builder; custom domains with DNS verification; online admissions; a per-school **rules engine** (grading bands, weights, promotion, attendance thresholds, invoicing, installments, discounts, offline conflict policy, canteen limits, SMS, Paystack).

**Academics** — years/terms, classes, subjects, teacher assignments, rooms, periods, timetable with clash detection, assessments and marks, computed result sheets with dense ranking, review→approve→publish workflow, comments, report cards.

**People** — students (auto IDs, plan limits, promotion), guardians and parent logins, staff and logins, signed-QR ID cards with verification, admissions.

**Attendance — offline-first** — class registers on any device, IndexedDB queue, automatic sync with idempotent operations, versioned records and three conflict policies (latest wins / server wins / manual resolution screen); daily overview; chronic absentee report.

**Finance** — fee categories/structures per level or class, discounts and sibling discounts, invoice generation with installments, cash/MoMo/bank/cheque payments with receipts, **Paystack** online payments (fees and wallet top-ups) with verified webhooks, reversals, append-only ledger, statements, ageing report, top defaulters, CSV exports.

**Canteen & inventory** — menu and stock with low-stock alerts, student wallets with daily limits and freezing, point-of-sale (wallet or cash, QR scan), meal plans, inventory items and movements.

**Welfare & operations** — **discipline** (incidents, severity, demerit points, trends), **calendar & events** (audiences, public events, notifications), **assignments/homework** (submission tracking, grading, parent/student view), **library** (catalogue, loans, overdue, fines), **transport** (routes, stops, drivers, capacity, rider assignment), **clinic** (confidential health records, visits, parent notification), **messaging** (direct, group and whole-class threads), **HR** (leave requests/approvals, payroll runs, payslips).

**Communication** — announcements to targeted audiences by in-app, SMS and email; notifications centre.

**Reports & analytics** — enrolment, attendance by class and week, finance ageing and collections, academic performance by class/subject, staff workload, birthdays.

**Printable documents (PDF)** — receipts, invoices, statements, class lists, attendance registers, single and batch report cards, transcripts, ID card sheets, payslips, timetables.

**Data ownership** — every school downloads its complete database (JSON, CSV, restorable SQL, or all in one ZIP) from Settings → Data & backup; the platform can export any school; every export is audited.

**Six role dashboards**, each in its own file: administrator, teacher, parent, student, finance, canteen.

## Repository layout

```
school-os/
├── api/                 NestJS backend (see api/README.md)
│   ├── prisma/          schema.prisma (73 models), migrations (schema + RLS), seed.ts (demo school)
│   ├── src/             one folder per module — 37 modules, ~18,000 lines
│   ├── scripts/         smoke.js (222 checks), gen-migration.js, gen-docs.js, enable-wasm-engine.js
│   └── docs/            openapi.json (exported from Swagger)
├── web/                 Next.js frontend (see web/README.md)
│   ├── app/             66 pages — dashboards under app/school/dashboards/<role>/page.tsx
│   ├── components/      UI kit, app shell, charts, school website renderer
│   └── lib/             api client, auth, offline queue, types, tenant/host resolution
└── docs/                ARCHITECTURE, MODULES, API, ERD, SECURITY, DATA-OWNERSHIP, OFFLINE-SYNC, DEPLOYMENT, user-guides/
```

## Quick start on macOS (PostgreSQL 18 at /Library/PostgreSQL/18)

```zsh
# 1. Database
/Library/PostgreSQL/18/bin/psql -U postgres -h localhost -c "CREATE DATABASE schoolos;"

# 2. API
cd api
cp .env.example .env            # set DATABASE_URL=postgresql://postgres:YOURPASSWORD@localhost:5432/schoolos?schema=public
npm install
npx prisma generate
npx prisma migrate deploy       # tables + Row-Level Security + application role
npm run seed                    # demo school "Bright Future Academy" + platform owner
npm run start:dev               # http://localhost:4000 · Swagger at /docs

# 3. Web (new terminal)
cd web
cp .env.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1, NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000
npm install
npm run dev                     # http://localhost:3000  (school portal also at http://brightfuture.localhost:3000)
```

**Demo logins** (password for all: `Password123!`)

| Role | Email |
|---|---|
| Platform owner | admin@schoolos.app → http://localhost:3000/platform/login |
| School admin | admin@brightfuture.edu.gh |
| Class teacher | teacher@brightfuture.edu.gh |
| Subject teacher | teacher2@brightfuture.edu.gh |
| Accountant | accounts@brightfuture.edu.gh |
| Canteen manager | canteen@brightfuture.edu.gh |
| Parent (2 children) | parent@brightfuture.edu.gh |

Verification: `cd api && npm test` (unit) and `npm run smoke` (end-to-end against a running API).

## Deploy

Full instructions in `docs/DEPLOYMENT.md`. In short: Railway service with root directory `api` (+ PostgreSQL plugin, `railway.json` runs `prisma migrate deploy` on start); Vercel project with root directory `web`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ROOT_DOMAIN`, and the wildcard domain `*.yourdomain.com` so every school gets `slug.yourdomain.com`. Paystack webhook: `https://<api>/api/v1/public/webhooks/paystack`.

## Security model (summary)

Tenant isolation at two layers (tenant-scoped Prisma client + PostgreSQL RLS with `FORCE`, API connecting as a non-superuser role); JWT access tokens with rotating refresh tokens; roles → permissions → guards on every route; plan/feature flags enforced server-side; teachers/parents/students scoped to their own data; append-only ledger; signed ID-card QR codes; HMAC-verified payment webhooks; immutable audit log. Details in `docs/SECURITY.md`.

## Known limits

* The UI has been type-checked, built and server-rendered, not click-tested in a browser — expect small polish items.
* Paystack, Arkesel SMS and SMTP are implemented and unit-exercised through log providers; they have not been run against live accounts.
* Not built: document/file storage (attachments are URLs), AI assistant, offline canteen POS.
