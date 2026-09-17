# API reference

Base URL: `/api/v1`. Interactive documentation (Swagger UI) is served at `/docs` and the raw OpenAPI 3 document at `/docs-json` (a copy is kept in `api/docs/openapi.json`).

All endpoints except **auth** (login/refresh) and **public** require `Authorization: Bearer <accessToken>`. School-scoped endpoints run under the caller's school; platform endpoints require a platform account.

| Area | Endpoints |
|---|---|
| other | 1 |
| audit | 1 |
| documents | 9 |
| communications | 8 |
| data | 3 |
| analytics | 7 |
| auth | 11 |
| platform | 24 |
| school | 12 |
| users | 9 |
| academic | 22 |
| students | 18 |
| staff | 6 |
| attendance | 5 |
| sync | 10 |
| fees | 24 |
| results | 18 |
| timetable | 12 |
| canteen-plans | 14 |
| canteen | 12 |
| inventory | 7 |
| admissions | 4 |
| dashboard | 4 |
| portal | 20 |
| assignments | 7 |
| discipline | 8 |
| health | 5 |
| transport | 12 |
| library | 10 |
| events | 9 |
| exports | 6 |
| public | 7 |
| subscription | 2 |
| messaging | 6 |
| hr | 14 |
| reports | 5 |

## other

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` |  |

## audit

| Method | Path | Description |
|---|---|---|
| `GET` | `/audit` |  |

## documents

| Method | Path | Description |
|---|---|---|
| `GET` | `/documents/invoices/{id}.pdf` | Fee invoice with installment plan and payment history |
| `GET` | `/documents/students/{id}/statement.pdf` | Statement of account (invoices, payments, running balance) |
| `GET` | `/documents/classes/{id}/list.pdf` | Class list with guardian phone numbers |
| `GET` | `/documents/classes/{id}/register.pdf` | Attendance register for a class over a date range (max 12 days per page) |
| `GET` | `/documents/results/report-cards.pdf` | Every report card of a class for a term in one PDF (one page per student) |
| `GET` | `/documents/students/{id}/transcript.pdf` | Academic transcript — every published term for a student |
| `GET` | `/documents/students/id-cards.pdf` | Printable ID card sheet for a class (8 cards per A4 page, signed QR codes) |
| `GET` | `/documents/payroll/{runId}/payslips/{staffId}.pdf` | Payslip for one staff member (staff can download their own) |
| `GET` | `/documents/timetable/{kind}/{id}.pdf` | Weekly timetable for a class, teacher or room |

## communications

| Method | Path | Description |
|---|---|---|
| `GET` | `/announcements` |  |
| `POST` | `/announcements` |  |
| `PATCH` | `/announcements/{id}` |  |
| `DELETE` | `/announcements/{id}` |  |
| `POST` | `/announcements/{id}/publish` |  |
| `GET` | `/notifications/me` |  |
| `POST` | `/notifications/read-all` |  |
| `POST` | `/notifications/{id}/read` |  |

## data

| Method | Path | Description |
|---|---|---|
| `GET` | `/data/summary` |  |
| `GET` | `/data/exports` |  |
| `GET` | `/data/export.zip` |  |

## analytics

| Method | Path | Description |
|---|---|---|
| `GET` | `/analytics/enrollment` |  |
| `GET` | `/analytics/attendance` |  |
| `GET` | `/analytics/fees` |  |
| `GET` | `/analytics/results` |  |
| `GET` | `/analytics/canteen` |  |
| `GET` | `/analytics/staff` |  |
| `GET` | `/analytics/birthdays` |  |

## auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` |  |
| `POST` | `/auth/platform/login` |  |
| `POST` | `/auth/refresh` |  |
| `POST` | `/auth/logout` |  |
| `POST` | `/auth/forgot-password` |  |
| `POST` | `/auth/reset-password` |  |
| `GET` | `/auth/sessions` |  |
| `DELETE` | `/auth/sessions/{id}` |  |
| `POST` | `/auth/sessions/revoke-all` |  |
| `GET` | `/auth/me` |  |
| `POST` | `/auth/change-password` |  |

## platform

| Method | Path | Description |
|---|---|---|
| `GET` | `/platform/stats` |  |
| `GET` | `/platform/schools` |  |
| `GET` | `/platform/schools/{id}` |  |
| `PATCH` | `/platform/schools/{id}` |  |
| `POST` | `/platform/schools/{id}/approve` |  |
| `POST` | `/platform/schools/{id}/activate` |  |
| `POST` | `/platform/schools/{id}/suspend` |  |
| `POST` | `/platform/schools/{id}/reject` |  |
| `PATCH` | `/platform/schools/{id}/features` |  |
| `POST` | `/platform/schools/{id}/support-session` |  |
| `PATCH` | `/platform/schools/{id}/subscription` |  |
| `POST` | `/platform/schools/{id}/subscription/invoices` |  |
| `GET` | `/platform/schools/{id}/data-summary` |  |
| `GET` | `/platform/schools/{id}/export.zip` |  |
| `GET` | `/platform/subscription-invoices` |  |
| `POST` | `/platform/subscription-invoices/{id}/mark-paid` |  |
| `GET` | `/platform/plans` |  |
| `POST` | `/platform/plans` |  |
| `PATCH` | `/platform/plans/{id}` |  |
| `GET` | `/platform/users` |  |
| `POST` | `/platform/users` |  |
| `PATCH` | `/platform/users/{id}` |  |
| `GET` | `/platform/audit` |  |
| `GET` | `/platform/sync-overview` |  |

## school

| Method | Path | Description |
|---|---|---|
| `GET` | `/school/profile` |  |
| `PATCH` | `/school/profile` |  |
| `PATCH` | `/school/branding` |  |
| `GET` | `/school/settings` |  |
| `PATCH` | `/school/settings` |  |
| `GET` | `/school/domains` |  |
| `POST` | `/school/domains` |  |
| `POST` | `/school/domains/{id}/verify` |  |
| `POST` | `/school/domains/{id}/primary` |  |
| `DELETE` | `/school/domains/{id}` |  |
| `GET` | `/school/website` |  |
| `PUT` | `/school/website` |  |

## users

| Method | Path | Description |
|---|---|---|
| `GET` | `/users` |  |
| `POST` | `/users` |  |
| `PATCH` | `/users/{id}` |  |
| `POST` | `/users/{id}/reset-password` |  |
| `GET` | `/roles` |  |
| `POST` | `/roles` |  |
| `GET` | `/roles/permissions` |  |
| `PATCH` | `/roles/{id}` |  |
| `DELETE` | `/roles/{id}` |  |

## academic

| Method | Path | Description |
|---|---|---|
| `GET` | `/academic/current` |  |
| `GET` | `/academic/years` |  |
| `POST` | `/academic/years` |  |
| `POST` | `/academic/rollover/preview` |  |
| `POST` | `/academic/rollover` |  |
| `PATCH` | `/academic/years/{id}` |  |
| `GET` | `/academic/terms` |  |
| `POST` | `/academic/terms` |  |
| `PATCH` | `/academic/terms/{id}` |  |
| `GET` | `/academic/classes` |  |
| `POST` | `/academic/classes` |  |
| `GET` | `/academic/classes/{id}` |  |
| `PATCH` | `/academic/classes/{id}` |  |
| `DELETE` | `/academic/classes/{id}` |  |
| `PUT` | `/academic/classes/{id}/subjects` |  |
| `GET` | `/academic/subjects` |  |
| `POST` | `/academic/subjects` |  |
| `PATCH` | `/academic/subjects/{id}` |  |
| `DELETE` | `/academic/subjects/{id}` |  |
| `GET` | `/academic/rooms` |  |
| `POST` | `/academic/rooms` |  |
| `DELETE` | `/academic/rooms/{id}` |  |

## students

| Method | Path | Description |
|---|---|---|
| `GET` | `/students` |  |
| `POST` | `/students` |  |
| `POST` | `/students/promote` |  |
| `GET` | `/students/import/template.csv` |  |
| `POST` | `/students/import/preview` |  |
| `POST` | `/students/import` |  |
| `POST` | `/students/verify-qr` |  |
| `GET` | `/students/{id}` |  |
| `PATCH` | `/students/{id}` |  |
| `GET` | `/students/{id}/id-card` |  |
| `POST` | `/students/{id}/login` |  |
| `POST` | `/students/{id}/guardians` |  |
| `DELETE` | `/students/{id}/guardians/{guardianId}` |  |
| `GET` | `/guardians` |  |
| `POST` | `/guardians` |  |
| `GET` | `/guardians/{id}` |  |
| `PATCH` | `/guardians/{id}` |  |
| `POST` | `/guardians/{id}/login` |  |

## staff

| Method | Path | Description |
|---|---|---|
| `GET` | `/staff/my-classes` |  |
| `GET` | `/staff` |  |
| `POST` | `/staff` |  |
| `GET` | `/staff/{id}` |  |
| `PATCH` | `/staff/{id}` |  |
| `POST` | `/staff/{id}/login` |  |

## attendance

| Method | Path | Description |
|---|---|---|
| `POST` | `/attendance/mark` |  |
| `GET` | `/attendance/register` |  |
| `GET` | `/attendance/summary` |  |
| `GET` | `/attendance/daily` |  |
| `GET` | `/attendance/student/{id}` |  |

## sync

| Method | Path | Description |
|---|---|---|
| `POST` | `/sync/devices/register` |  |
| `POST` | `/sync/devices/heartbeat` |  |
| `POST` | `/sync/push` |  |
| `GET` | `/sync/pull` |  |
| `GET` | `/sync/devices` |  |
| `POST` | `/sync/devices/{id}/disable` |  |
| `POST` | `/sync/devices/{id}/enable` |  |
| `GET` | `/sync/operations` |  |
| `GET` | `/sync/conflicts` |  |
| `POST` | `/sync/conflicts/{id}/resolve` |  |

## fees

| Method | Path | Description |
|---|---|---|
| `GET` | `/fees/categories` |  |
| `POST` | `/fees/categories` |  |
| `PATCH` | `/fees/categories/{id}` |  |
| `GET` | `/fees/structures` |  |
| `POST` | `/fees/structures` |  |
| `PATCH` | `/fees/structures/{id}` |  |
| `DELETE` | `/fees/structures/{id}` |  |
| `GET` | `/fees/discounts` |  |
| `POST` | `/fees/discounts` |  |
| `DELETE` | `/fees/discounts/{id}` |  |
| `POST` | `/fees/invoices/generate` |  |
| `GET` | `/fees/invoices` |  |
| `GET` | `/fees/invoices/{id}` |  |
| `POST` | `/fees/invoices/{id}/cancel` |  |
| `GET` | `/fees/payments` |  |
| `POST` | `/fees/payments` |  |
| `POST` | `/fees/payments/online/initiate` |  |
| `GET` | `/fees/payments/online/verify/{reference}` |  |
| `GET` | `/fees/payments/{id}` |  |
| `POST` | `/fees/payments/{id}/reverse` |  |
| `GET` | `/fees/payments/{id}/receipt.pdf` |  |
| `POST` | `/fees/reminders` |  |
| `GET` | `/fees/students/{id}/statement` |  |
| `GET` | `/fees/summary` |  |

## results

| Method | Path | Description |
|---|---|---|
| `GET` | `/results/workflow` |  |
| `GET` | `/results/assessments` |  |
| `POST` | `/results/assessments` |  |
| `PATCH` | `/results/assessments/{id}` |  |
| `DELETE` | `/results/assessments/{id}` |  |
| `GET` | `/results/assessments/{id}/marks` |  |
| `PUT` | `/results/assessments/{id}/marks` |  |
| `POST` | `/results/compute` |  |
| `POST` | `/results/submit` |  |
| `POST` | `/results/review` |  |
| `POST` | `/results/approve` |  |
| `POST` | `/results/publish` |  |
| `POST` | `/results/reject` |  |
| `GET` | `/results/overview` |  |
| `GET` | `/results/sheets` |  |
| `GET` | `/results/sheets/{id}` |  |
| `PATCH` | `/results/sheets/{id}/comments` |  |
| `GET` | `/results/sheets/{id}/report-card.pdf` |  |

## timetable

| Method | Path | Description |
|---|---|---|
| `GET` | `/timetable/periods` |  |
| `POST` | `/timetable/periods` |  |
| `PATCH` | `/timetable/periods/{id}` |  |
| `DELETE` | `/timetable/periods/{id}` |  |
| `POST` | `/timetable/slots` |  |
| `PATCH` | `/timetable/slots/{id}` |  |
| `DELETE` | `/timetable/slots/{id}` |  |
| `GET` | `/timetable/my` |  |
| `GET` | `/timetable/conflicts` |  |
| `GET` | `/timetable/class/{id}` |  |
| `GET` | `/timetable/teacher/{id}` |  |
| `GET` | `/timetable/room/{id}` |  |

## canteen-plans

| Method | Path | Description |
|---|---|---|
| `GET` | `/canteen/plans` |  |
| `POST` | `/canteen/plans` |  |
| `GET` | `/canteen/plans/summary` |  |
| `GET` | `/canteen/plans/enrolments` |  |
| `GET` | `/canteen/plans/student/{studentId}` |  |
| `POST` | `/canteen/plans/allowances/run` |  |
| `GET` | `/canteen/plans/{id}` |  |
| `PATCH` | `/canteen/plans/{id}` |  |
| `DELETE` | `/canteen/plans/{id}` |  |
| `PUT` | `/canteen/plans/{id}/items` |  |
| `POST` | `/canteen/plans/{id}/enrol` |  |
| `POST` | `/canteen/plans/enrolments/{id}/end` |  |
| `POST` | `/canteen/plans/enrolments/{id}/suspend` |  |
| `POST` | `/canteen/plans/enrolments/{id}/resume` |  |

## canteen

| Method | Path | Description |
|---|---|---|
| `GET` | `/canteen/items` |  |
| `POST` | `/canteen/items` |  |
| `PATCH` | `/canteen/items/{id}` |  |
| `POST` | `/canteen/items/{id}/stock` |  |
| `GET` | `/canteen/items/{id}/movements` |  |
| `GET` | `/canteen/low-stock` |  |
| `GET` | `/canteen/wallets/{studentId}` |  |
| `PATCH` | `/canteen/wallets/{studentId}` |  |
| `POST` | `/canteen/wallets/{studentId}/topup` |  |
| `POST` | `/canteen/sales` |  |
| `GET` | `/canteen/sales` |  |
| `GET` | `/canteen/summary` |  |

## inventory

| Method | Path | Description |
|---|---|---|
| `GET` | `/inventory/items` |  |
| `POST` | `/inventory/items` |  |
| `GET` | `/inventory/low-stock` |  |
| `PATCH` | `/inventory/items/{id}` |  |
| `DELETE` | `/inventory/items/{id}` |  |
| `POST` | `/inventory/items/{id}/move` |  |
| `GET` | `/inventory/items/{id}/movements` |  |

## admissions

| Method | Path | Description |
|---|---|---|
| `GET` | `/admissions` |  |
| `GET` | `/admissions/{id}` |  |
| `PATCH` | `/admissions/{id}/status` |  |
| `POST` | `/admissions/{id}/admit` |  |

## dashboard

| Method | Path | Description |
|---|---|---|
| `GET` | `/dashboard/school` |  |
| `GET` | `/dashboard/teacher` |  |
| `GET` | `/dashboard/finance` |  |
| `GET` | `/dashboard/canteen` |  |

## portal

| Method | Path | Description |
|---|---|---|
| `GET` | `/portal/overview` |  |
| `GET` | `/portal/children/{id}` |  |
| `GET` | `/portal/children/{id}/attendance` |  |
| `GET` | `/portal/children/{id}/results` |  |
| `GET` | `/portal/children/{id}/fees` |  |
| `GET` | `/portal/children/{id}/timetable` |  |
| `GET` | `/portal/children/{id}/wallet` |  |
| `GET` | `/portal/children/{id}/canteen-plan` |  |
| `POST` | `/portal/children/{id}/canteen-plan` |  |
| `GET` | `/portal/children/{id}/assignments` |  |
| `POST` | `/portal/children/{id}/assignments/{assignmentId}/submit` |  |
| `GET` | `/portal/children/{id}/discipline` |  |
| `GET` | `/portal/children/{id}/health` |  |
| `GET` | `/portal/children/{id}/transport` |  |
| `GET` | `/portal/children/{id}/library` |  |
| `GET` | `/portal/children/{id}/events` |  |
| `POST` | `/portal/payments/initiate` |  |
| `GET` | `/portal/payments/verify/{reference}` |  |
| `GET` | `/portal/children/{id}/results/{sheetId}/report-card.pdf` |  |
| `GET` | `/portal/payments/{id}/receipt.pdf` |  |

## assignments

| Method | Path | Description |
|---|---|---|
| `GET` | `/assignments` |  |
| `POST` | `/assignments` |  |
| `GET` | `/assignments/teacher-summary` |  |
| `GET` | `/assignments/{id}` |  |
| `PATCH` | `/assignments/{id}` |  |
| `DELETE` | `/assignments/{id}` |  |
| `PUT` | `/assignments/{id}/grades` |  |

## discipline

| Method | Path | Description |
|---|---|---|
| `GET` | `/discipline/categories` | Incident categories available to the school |
| `GET` | `/discipline/overview` | School-wide behaviour overview (trends, categories, classes, top students) |
| `GET` | `/discipline/incidents` |  |
| `POST` | `/discipline/incidents` |  |
| `GET` | `/discipline/incidents/{id}` |  |
| `PATCH` | `/discipline/incidents/{id}` |  |
| `DELETE` | `/discipline/incidents/{id}` |  |
| `GET` | `/discipline/students/{id}/summary` |  |

## health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health/summary` |  |
| `GET` | `/health/visits` |  |
| `POST` | `/health/visits` |  |
| `GET` | `/health/students/{id}` |  |
| `PUT` | `/health/students/{id}` |  |

## transport

| Method | Path | Description |
|---|---|---|
| `GET` | `/transport/summary` |  |
| `GET` | `/transport/routes` |  |
| `POST` | `/transport/routes` |  |
| `GET` | `/transport/routes/{id}` |  |
| `PATCH` | `/transport/routes/{id}` |  |
| `DELETE` | `/transport/routes/{id}` |  |
| `POST` | `/transport/routes/{id}/stops` |  |
| `PATCH` | `/transport/stops/{id}` |  |
| `DELETE` | `/transport/stops/{id}` |  |
| `POST` | `/transport/assignments` |  |
| `DELETE` | `/transport/assignments/{studentId}` |  |
| `GET` | `/transport/students/{id}` |  |

## library

| Method | Path | Description |
|---|---|---|
| `GET` | `/library/summary` |  |
| `GET` | `/library/books` |  |
| `POST` | `/library/books` |  |
| `PATCH` | `/library/books/{id}` |  |
| `DELETE` | `/library/books/{id}` |  |
| `GET` | `/library/loans` |  |
| `POST` | `/library/loans` |  |
| `POST` | `/library/loans/{id}/return` |  |
| `POST` | `/library/loans/{id}/fine-paid` |  |
| `GET` | `/library/students/{id}` |  |

## events

| Method | Path | Description |
|---|---|---|
| `GET` | `/events/types` |  |
| `GET` | `/events` |  |
| `POST` | `/events` |  |
| `GET` | `/events/all` |  |
| `GET` | `/events/upcoming` |  |
| `GET` | `/events/calendar` |  |
| `GET` | `/events/{id}` |  |
| `PATCH` | `/events/{id}` |  |
| `DELETE` | `/events/{id}` |  |

## exports

| Method | Path | Description |
|---|---|---|
| `GET` | `/exports/students.csv` |  |
| `GET` | `/exports/staff.csv` |  |
| `GET` | `/exports/invoices.csv` |  |
| `GET` | `/exports/payments.csv` |  |
| `GET` | `/exports/attendance.csv` |  |
| `GET` | `/exports/results.csv` |  |

## public

| Method | Path | Description |
|---|---|---|
| `GET` | `/public/site/{slug}` |  |
| `GET` | `/public/resolve-host` |  |
| `GET` | `/public/plans` |  |
| `POST` | `/public/schools/register` |  |
| `GET` | `/public/schools/{slug}/classes` |  |
| `POST` | `/public/admissions/{slug}/apply` |  |
| `POST` | `/public/webhooks/paystack` |  |

## subscription

| Method | Path | Description |
|---|---|---|
| `GET` | `/subscription` |  |
| `POST` | `/subscription/change` |  |

## messaging

| Method | Path | Description |
|---|---|---|
| `GET` | `/messages/contacts` |  |
| `GET` | `/messages/threads` |  |
| `POST` | `/messages/threads` |  |
| `GET` | `/messages/unread-count` |  |
| `GET` | `/messages/threads/{id}` |  |
| `POST` | `/messages/threads/{id}` |  |

## hr

| Method | Path | Description |
|---|---|---|
| `GET` | `/hr/summary` |  |
| `GET` | `/hr/leave` |  |
| `POST` | `/hr/leave` |  |
| `POST` | `/hr/leave/{id}/review` |  |
| `POST` | `/hr/leave/{id}/cancel` |  |
| `GET` | `/hr/on-leave` |  |
| `GET` | `/hr/payroll` |  |
| `POST` | `/hr/payroll` |  |
| `GET` | `/hr/payroll/{id}` |  |
| `PUT` | `/hr/payroll/{id}/items` |  |
| `POST` | `/hr/payroll/{id}/approve` |  |
| `POST` | `/hr/payroll/{id}/pay` |  |
| `POST` | `/hr/payroll/{id}/reopen` |  |
| `GET` | `/hr/payroll/{id}/payslips/{staffId}` |  |

## reports

| Method | Path | Description |
|---|---|---|
| `GET` | `/reports/enrolment` |  |
| `GET` | `/reports/attendance` |  |
| `GET` | `/reports/finance` |  |
| `GET` | `/reports/academic` |  |
| `GET` | `/reports/staff` |  |

## Conventions

- List endpoints accept `page`, `pageSize` (max 200) and `search` and return `{ items, total, page, pageSize }`.
- Money is returned as decimal numbers in the school currency; dates as ISO-8601 UTC.
- Errors are `{ statusCode, code?, message, path, requestId, timestamp }`. Codes you can act on: `TENANT_PENDING`, `TENANT_SUSPENDED`, `PERMISSION_DENIED`, `FEATURE_NOT_IN_PLAN`, `PLAN_LIMIT_REACHED`, `TIMETABLE_CONFLICT`, `INSUFFICIENT_BALANCE`, `INSUFFICIENT_STOCK`, `DAILY_LIMIT`, `PAYMENTS_NOT_CONFIGURED`, `DUPLICATE`.
- PDFs are returned inline with `Content-Disposition`; CSVs as attachments with a UTF-8 BOM for Excel.
