/** Generates docs/ERD.md (mermaid ER diagram from the Prisma data model) and docs/API.md (from the exported OpenAPI document). Run from api/: node scripts/gen-docs.js */
const fs = require('fs');
const { Prisma } = require('@prisma/client');
const dm = Prisma.dmmf.datamodel;
let out = '# Entity-relationship diagram\n\nGenerated from `api/prisma/schema.prisma` (' + dm.models.length + ' models, ' + dm.enums.length + ' enums). Every table with a `tenantId` column is protected by PostgreSQL Row-Level Security.\n\n```mermaid\nerDiagram\n';
const typeMap = { String: 'string', Int: 'int', Boolean: 'bool', DateTime: 'datetime', Decimal: 'decimal', Json: 'json', Float: 'float' };
for (const m of dm.models) {
  out += '  ' + m.name + ' {\n';
  for (const f of m.fields) if (f.kind !== 'object') out += '    ' + (f.kind === 'enum' ? f.type : (typeMap[f.type] || f.type)) + (f.isList ? '_list' : '') + ' ' + f.name + (f.isId ? ' PK' : f.isUnique ? ' UK' : '') + '\n';
  out += '  }\n';
}
for (const m of dm.models) for (const f of m.fields) if (f.kind === 'object' && f.relationFromFields && f.relationFromFields.length) out += '  ' + f.type + ' ||--o{ ' + m.name + ' : "' + f.name + '"\n';
out += '```\n\n## Enumerations\n\n';
for (const e of dm.enums) out += '- **' + e.name + '**: ' + e.values.map((v) => v.name).join(', ') + '\n';
out += '\n## Tables by area\n\n';
const areas = { Platform: ['PlatformUser', 'PlatformSetting', 'Plan', 'Tenant', 'TenantDomain', 'Subscription', 'SubscriptionInvoice', 'Sequence', 'AuditLog', 'DataExport'], 'Identity & access': ['User', 'Role', 'UserRole', 'RefreshToken', 'PasswordResetToken'], Academics: ['AcademicYear', 'Term', 'SchoolClass', 'Subject', 'ClassSubject', 'Room', 'Period', 'TimetableSlot', 'Assessment', 'Mark', 'ResultSheet', 'Assignment', 'AssignmentSubmission'], People: ['Staff', 'Student', 'Guardian', 'StudentGuardian', 'Admission', 'DisciplineIncident', 'HealthRecord', 'HealthVisit'], 'Attendance & sync': ['Attendance', 'Device', 'SyncOperation', 'SyncConflict'], Finance: ['FeeCategory', 'FeeStructure', 'StudentDiscount', 'Invoice', 'InvoiceLine', 'Installment', 'Payment', 'StudentAccount', 'LedgerEntry', 'PayrollRun', 'PayrollItem'], 'Canteen & inventory': ['CanteenItem', 'CanteenPlan', 'CanteenPlanItem', 'StudentCanteenPlan', 'Wallet', 'WalletTransaction', 'CanteenSale', 'StockMovement', 'InventoryItem', 'InventoryMovement'], Communication: ['Announcement', 'Notification', 'MessageThread', 'MessageParticipant', 'Message', 'SchoolEvent'], Operations: ['LibraryBook', 'LibraryLoan', 'TransportRoute', 'TransportStop', 'TransportAssignment', 'LeaveRequest'] };
for (const [area, names] of Object.entries(areas)) out += '- **' + area + '**: ' + names.filter((n) => dm.models.some((m) => m.name === n)).join(', ') + '\n';
fs.writeFileSync(require('path').join(__dirname, '..', '..', 'docs', 'ERD.md'), out);
console.log('ERD written', out.length, 'chars');

const spec = require('../docs/openapi.json');
const tags = {};
for (const [path, ops] of Object.entries(spec.paths)) for (const [method, op] of Object.entries(ops)) { const tag = (op.tags && op.tags[0]) || 'other'; (tags[tag] ||= []).push({ method: method.toUpperCase(), path, summary: op.summary || '' }); }
let api = '# API reference\n\nBase URL: `/api/v1`. Interactive documentation (Swagger UI) is served at `/docs` and the raw OpenAPI 3 document at `/docs-json` (a copy is kept in `api/docs/openapi.json`).\n\nAll endpoints except **auth** (login/refresh) and **public** require `Authorization: Bearer <accessToken>`. School-scoped endpoints run under the caller\'s school; platform endpoints require a platform account.\n\n| Area | Endpoints |\n|---|---|\n';
for (const [tag, list] of Object.entries(tags)) api += '| ' + tag + ' | ' + list.length + ' |\n';
api += '\n';
for (const [tag, list] of Object.entries(tags)) { api += '## ' + tag + '\n\n| Method | Path | Description |\n|---|---|---|\n'; for (const e of list) api += '| `' + e.method + '` | `' + e.path.replace('/api/v1', '') + '` | ' + e.summary + ' |\n'; api += '\n'; }
api += '## Conventions\n\n- List endpoints accept `page`, `pageSize` (max 200) and `search` and return `{ items, total, page, pageSize }`.\n- Money is returned as decimal numbers in the school currency; dates as ISO-8601 UTC.\n- Errors are `{ statusCode, code?, message, path, requestId, timestamp }`. Codes you can act on: `TENANT_PENDING`, `TENANT_SUSPENDED`, `PERMISSION_DENIED`, `FEATURE_NOT_IN_PLAN`, `PLAN_LIMIT_REACHED`, `TIMETABLE_CONFLICT`, `INSUFFICIENT_BALANCE`, `INSUFFICIENT_STOCK`, `DAILY_LIMIT`, `PAYMENTS_NOT_CONFIGURED`, `DUPLICATE`.\n- PDFs are returned inline with `Content-Disposition`; CSVs as attachments with a UTF-8 BOM for Excel.\n';
fs.writeFileSync(require('path').join(__dirname, '..', '..', 'docs', 'API.md'), api);
console.log('API.md', Object.keys(tags).length, 'tags,', Object.values(tags).reduce((a, l) => a + l.length, 0), 'operations');
