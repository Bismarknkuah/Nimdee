# Modules

Every module lives in `api/src/<module>/` (DTOs, service, controller, module) and has one or more pages under `web/app/school/`. Permissions come from `api/src/common/permissions.ts`; features from `api/src/common/features.ts`.

Every school configures which basic-education levels it runs (KG / Primary / JHS) and its residency (day / boarding / both) under Settings → Rules engine → School levels & residency — this is enforced in the `academic` and `students` modules below. See `ARCHITECTURE.md#ghana-basic-school-scope` for the underlying model.

| Module | What it does | Feature flag | Key permissions | Frontend |
|---|---|---|---|---|
| auth | Login, refresh-token rotation, logout, password change/reset, `GET /auth/me` | — | — | `/login`, `/platform/login` |
| platform | Schools registry, approve/suspend/reactivate, plans, subscription invoices, feature overrides, support sessions, cross-school audit, sync health, per-school data export | — | platform account | `/platform/*` |
| schools | Profile, branding, rules engine, domains (DNS TXT verification), website builder | WEBSITE, CUSTOM_DOMAIN | SCHOOL_MANAGE, SETTINGS_MANAGE | `/school/settings`, `/school/website` |
| users / roles | Users, roles, 60+ permissions, password resets | — | USERS_MANAGE, ROLES_MANAGE | `/school/users` |
| academic | Years, terms, classes, subjects, class–subject–teacher, rooms, **Ghana basic-school setup** (`GET/POST /academic/ghana-basic`: idempotent KG/Primary/JHS classes + GES subjects + promotion chain) | ACADEMICS | ACADEMIC_MANAGE | `/school/academics`, `/school/classes/[id]` |
| students | Enrolment (auto IDs, plan limits, **residency enforced by the school's day/boarding setting**), guardians, promotion/transfer, signed QR ID cards, verification | ACADEMICS | STUDENT_* | `/school/students`, `/school/id-cards` |
| staff | Staff records, logins, my-classes | — | STAFF_* | `/school/staff` |
| attendance | Register, summaries, daily overview, chronic absentees, CSV | ATTENDANCE | ATTENDANCE_MARK/VIEW | `/school/attendance` |
| sync | Device registration, snapshot, push queue, conflicts, operations log | OFFLINE_SYNC | SYNC_MANAGE | `/school/sync` |
| fees | Categories, structures, discounts, invoice generation, installments, payments, receipts, reversals, ledger, statements, Paystack | FEES | FEES_*, INVOICE_CREATE, PAYMENT_RECORD, REFUND_APPROVE | `/school/fees/*` |
| results | Assessments, marks, computation (grading scale picked per class level — letters for KG/Primary, BECE 1–9 for JHS), workflow, comments, report cards | RESULTS | RESULT_ENTER/REVIEW/APPROVE/PUBLISH | `/school/results/*` |
| timetable | Periods, slots, clash detection, class/teacher/room views | TIMETABLE | TIMETABLE_MANAGE/VIEW | `/school/timetable` |
| canteen | Items, stock, wallets, limits, POS, meal plans, daily summary | CANTEEN | CANTEEN_*, WALLET_TOPUP | `/school/canteen/*` |
| inventory | Assets and supplies with movements | INVENTORY | INVENTORY_* | `/school/inventory` |
| communications | Announcements (in-app/SMS/email), notifications | COMMUNICATIONS | ANNOUNCEMENT_MANAGE | `/school/announcements` |
| messaging | Direct, group and whole-class conversations, unread counts | MESSAGING | MESSAGES_SEND | `/school/messages` |
| events | School calendar, audiences, public events, month view | EVENTS | EVENTS_MANAGE | `/school/events` |
| assignments | Homework per class/subject, submission tracking, grading | ASSIGNMENTS | ASSIGNMENTS_* | `/school/assignments` |
| discipline | Incidents, severity, demerit points, sanctions, trends | DISCIPLINE | DISCIPLINE_* | `/school/discipline` |
| library | Catalogue, copies, loans, overdue, fines | LIBRARY | LIBRARY_* | `/school/library` |
| transport | Routes, stops, vehicles/drivers, rider assignment with capacity | TRANSPORT | TRANSPORT_* | `/school/transport` |
| health | Confidential health records, clinic visits, parent notification | HEALTH | HEALTH_* | `/school/health` |
| hr | Leave requests/approvals, payroll runs (draft→approved→paid), payslips | HR | LEAVE_REQUEST, HR_MANAGE, PAYROLL_MANAGE | `/school/hr` |
| reports / analytics | Enrolment, attendance by class/week, finance ageing, academic performance, staff workload, birthdays | ANALYTICS | REPORTS_VIEW | `/school/reports` |
| data | **Full school data export** (ZIP with JSON + CSV + SQL, manifest, history) | — | SCHOOL_MANAGE / platform | Settings → Data & backup; Platform → school → Data & backup |
| exports | CSV exports (students, staff, attendance, invoices, payments, results) | — | EXPORT_DATA | buttons on list pages |
| documents (pdf) | Invoice, statement, receipt, class list, register, report cards (single/batch), transcript, ID cards, payslip, timetable | per document | per document | buttons on detail pages |
| portal | Parent/student views: children, attendance, results, fees + online payment, timetable, wallet, homework, behaviour, health, transport, library, events | PARENT_PORTAL | — | `/school/portal/*`, dashboards |
| dashboard | Role dashboards (admin, teacher, finance, canteen) | — | — | `/school/dashboards/*` |
| admissions | Online applications, review workflow, admit into class | — | ADMISSIONS_MANAGE | `/school/admissions`, `/site/[slug]/apply` |
| subscriptions | Plan view, upgrade requests, invoices, lifecycle job | — | SUBSCRIPTION_MANAGE | Settings → Subscription |
| audit | Immutable audit log of every sensitive action | — | AUDIT_VIEW | `/school/audit` |
| public | Registration, school website config, admissions form, Paystack webhook | — | — | `/register`, `/site/*` |

## System roles

School Admin (configures the school: roles, features, settings; no day-to-day data entry), Proprietor (oversight and reporting only, plus billing), Headmaster, Academic Head, Teacher, Class Teacher, Accountant, Cashier, Canteen Manager, Nurse, Librarian, HR Officer, Parent, Student. Roles are editable per school; custom roles can be created from the permission catalogue.

## Plans (defaults, editable by the platform)

* **Starter** — academics, attendance, offline sync, fees, results, events.
* **Professional** — Starter + timetable, canteen, parent portal, website, communications, inventory, analytics, discipline, assignments, messaging, health, library.
* **Enterprise** — everything, including custom domains, transport, HR and API access.
