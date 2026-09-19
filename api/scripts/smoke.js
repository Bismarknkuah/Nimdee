/* eslint-disable */
/**
 * End-to-end smoke test against a running API + seeded database.
 *   API_URL=http://localhost:4000 node scripts/smoke.js
 * Exercises: platform admin, onboarding + approval, RBAC, academics, students, attendance,
 * offline sync (idempotency + conflicts), fees/ledger/receipts, results workflow + report cards,
 * timetable conflicts, canteen POS, inventory, communications, admissions, parent portal, exports,
 * subscriptions and cross-tenant isolation.
 */
const API = (process.env.API_URL || 'http://localhost:4000') + '/api/v1';
const PASSWORD = 'Password123!';
let passed = 0,
  failed = 0;
const failures = [];

async function call(method, path, { token, body, raw } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  const data = raw ? await res.arrayBuffer() : ct.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, data, ct };
}
function check(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ✘ ${name}${extra !== undefined ? ' → ' + JSON.stringify(extra).slice(0, 400) : ''}`);
  }
}
const section = (t) => console.log(`\n== ${t}`);
const today = new Date().toISOString().slice(0, 10);

(async () => {
  // ─── Platform ───
  section('Platform');
  let r = await call('POST', '/auth/platform/login', { body: { email: 'admin@schoolos.app', password: PASSWORD } });
  check('platform login', r.status === 201 && r.data.accessToken, r.data);
  const P = r.data.accessToken;
  r = await call('GET', '/platform/stats', { token: P });
  check('platform stats', r.status === 200 && r.data.totals.students >= 32, r.data);
  r = await call('GET', '/platform/plans', { token: P });
  check('plans listed', r.status === 200 && r.data.length >= 3);

  // ─── Onboarding + approval flow ───
  section('Onboarding');
  const slug = 'smoke' + Date.now().toString(36);
  r = await call('POST', '/public/schools/register', {
    body: {
      name: 'Smoke Test School',
      slug,
      adminFirstName: 'Test',
      adminLastName: 'Admin',
      adminEmail: `admin@${slug}.edu.gh`,
      adminPassword: PASSWORD,
      planCode: 'STARTER',
      region: 'Ashanti',
    },
  });
  check('school registered (pending)', r.status === 201 && r.data.school.status === 'PENDING', r.data);
  const newSchoolId = r.data.school?.id;
  r = await call('POST', '/auth/login', { body: { school: slug, email: `admin@${slug}.edu.gh`, password: PASSWORD } });
  check('pending school can log in (limited)', r.status === 201, r.data);
  const pendingTok = r.data.accessToken;
  r = await call('GET', '/students', { token: pendingTok });
  check(
    'pending school blocked from modules (TENANT_PENDING)',
    r.status === 403 && r.data.code === 'TENANT_PENDING',
    r.data,
  );
  r = await call('GET', '/auth/me', { token: pendingTok });
  check('pending school can read /auth/me', r.status === 200 && r.data.tenant.status === 'PENDING', r.data);
  r = await call('POST', `/platform/schools/${newSchoolId}/approve`, { token: P, body: {} });
  check('platform approves school', r.status === 201 && r.data.status === 'ACTIVE', r.data);
  r = await call('GET', '/academic/current', { token: pendingTok });
  check(
    'approved school active (cache invalidated)',
    r.status === 200 && r.data.year && r.data.terms.length === 3,
    r.data,
  );
  const school2 = { token: pendingTok, id: newSchoolId };
  r = await call('POST', '/schools/register', {});
  r = await call('POST', '/public/schools/register', {
    body: {
      name: 'Dup',
      slug,
      adminFirstName: 'a',
      adminLastName: 'b',
      adminEmail: 'x@y.com',
      adminPassword: PASSWORD,
    },
  });
  check('duplicate slug rejected', r.status === 409, r.data);

  // ─── Demo school admin ───
  section('School admin');
  r = await call('POST', '/auth/login', {
    body: { school: 'brightfuture', email: 'admin@brightfuture.edu.gh', password: PASSWORD },
  });
  check('admin login', r.status === 201, r.data);
  const A = r.data.accessToken;
  const refreshToken = r.data.refreshToken;
  r = await call('GET', '/auth/me', { token: A });
  check(
    '/auth/me has permissions + features (School Admin manages, does not enter data)',
    r.status === 200 &&
      r.data.permissions.includes('SCHOOL_MANAGE') &&
      !r.data.permissions.includes('STUDENT_CREATE') &&
      r.data.features.includes('FEES'),
    r.data,
  );
  r = await call('POST', '/auth/refresh', { body: { refreshToken } });
  check('refresh token rotation', r.status === 201 && r.data.accessToken, r.data);

  // Headmaster: the operational head of school. Day-to-day actions that School Admin (pure
  // configuration) and Proprietor (pure oversight) deliberately no longer hold — enrolling and
  // editing students, the results approval chain, building the timetable, inventory movements and
  // approving a refund — are exercised as the Headmaster instead, since that is who actually holds
  // those permissions now.
  r = await call('POST', '/auth/login', {
    body: { school: 'brightfuture', email: 'headmaster@brightfuture.edu.gh', password: PASSWORD },
  });
  check('headmaster login (for operational actions admin no longer performs)', r.status === 201, r.data);
  const H = r.data.accessToken;
  r = await call('POST', '/auth/refresh', { body: { refreshToken } });
  check('old refresh token revoked', r.status === 401, r.data);
  r = await call('POST', '/auth/login', {
    body: { school: 'brightfuture', email: 'admin@brightfuture.edu.gh', password: 'wrong' },
  });
  check('bad password rejected', r.status === 401);
  r = await call('GET', '/school/profile', { token: A });
  check('school profile', r.status === 200 && r.data.code === 'SCH-GH-000001', r.data);
  r = await call('PATCH', '/school/settings', { token: A, body: { academic: { caWeight: 40, examWeight: 70 } } });
  check('rules engine validation (weights must total 100)', r.status === 400, r.data);
  r = await call('PATCH', '/school/settings', {
    token: A,
    body: { academic: { caWeight: 40, examWeight: 60 }, sync: { conflictPolicy: 'LATEST_WINS' } },
  });
  check('rules engine update', r.status === 200 && r.data.academic.caWeight === 40, r.data);
  r = await call('PATCH', '/school/branding', { token: A, body: { primaryColor: '#7c3aed' } });
  check('branding update', r.status === 200 && r.data.primaryColor === '#7c3aed', r.data);
  r = await call('GET', '/school/website', { token: A });
  check('website config', r.status === 200 && Array.isArray(r.data.sections), r.data);
  r = await call('PUT', '/school/website', {
    token: A,
    body: { sections: r.data.sections.map((s) => ({ ...s, enabled: true })), published: true },
  });
  check('website update', r.status === 200 && r.data.published === true, r.data);
  r = await call('GET', '/auth/me', { token: A });
  const demoTenantId = r.data.tenant.id;
  r = await call('POST', '/school/domains', { token: A, body: { domain: 'portal.brightfuture.edu.gh' } });
  check(
    'custom domain gated by plan (FEATURE_NOT_IN_PLAN)',
    r.status === 403 && r.data.code === 'FEATURE_NOT_IN_PLAN',
    r.data,
  );
  r = await call('PATCH', `/platform/schools/${demoTenantId}/features`, {
    token: P,
    body: { featureOverrides: ['CUSTOM_DOMAIN'] },
  });
  check('platform grants feature override', r.status === 200 && r.data.includes('CUSTOM_DOMAIN'), r.data);
  r = await call('POST', '/school/domains', { token: A, body: { domain: 'portal.brightfuture.edu.gh' } });
  check(
    'custom domain added with DNS instructions',
    r.status === 201 && r.data.instructions.steps.length === 2,
    r.data,
  );
  const domainId = r.data.id;
  r = await call('POST', `/school/domains/${domainId}/verify`, { token: A });
  check('domain verify fails until TXT record exists', r.status === 400, r.data);
  r = await call('GET', '/public/site/brightfuture');
  check(
    'public school site',
    r.status === 200 && r.data.school.name === 'Bright Future Academy' && r.data.news.length >= 1,
    r.data,
  );
  r = await call('GET', '/public/resolve-host?host=brightfuture.localhost:3000');
  check('host → tenant resolution', r.status === 200 && r.data.found && r.data.tenant.slug === 'brightfuture', r.data);

  // ─── Users & roles ───
  section('Users & roles');
  r = await call('GET', '/roles', { token: A });
  check('system roles seeded', r.status === 200 && r.data.length >= 8, r.data);
  const teacherRole = r.data.find((x) => x.name === 'Teacher');
  r = await call('POST', '/roles', {
    token: A,
    body: { name: 'Bursar', permissions: ['FEES_VIEW', 'PAYMENT_RECORD', 'NOT_A_PERMISSION'] },
  });
  check('unknown permission rejected', r.status === 400, r.data);
  r = await call('POST', '/roles', {
    token: A,
    body: { name: 'Bursar', permissions: ['FEES_VIEW', 'PAYMENT_RECORD'] },
  });
  check('custom role created', r.status === 201, r.data);
  r = await call('POST', '/users', {
    token: A,
    body: {
      email: 'newteacher@brightfuture.edu.gh',
      firstName: 'New',
      lastName: 'Teacher',
      userType: 'TEACHER',
      roleIds: [teacherRole.id],
    },
  });
  check('user created with temporary password', r.status === 201 && r.data.temporaryPassword, r.data);
  const newUserId = r.data.id;
  r = await call('POST', `/users/${newUserId}/reset-password`, { token: A });
  check('password reset', r.status === 201 && r.data.temporaryPassword, r.data);

  // ─── Academics ───
  section('Academics');
  r = await call('GET', '/academic/current', { token: A });
  check('current term', r.status === 200 && r.data.term, r.data);
  const term = r.data.term,
    year = r.data.year;
  r = await call('GET', '/academic/classes', { token: A });
  check('classes listed with counts', r.status === 200 && r.data.length === 4 && r.data[0].studentCount === 8, r.data);
  const classes = r.data;
  const p5 = classes.find((c) => c.name === 'Basic 5');
  const jhs1 = classes.find((c) => c.name === 'JHS 1');
  r = await call('GET', `/academic/classes/${p5.id}`, { token: A });
  check('class detail with subjects', r.status === 200 && r.data.subjects.length === 6, r.data);
  const subjects = r.data.subjects.map((s) => s.subject);
  r = await call('POST', '/academic/classes', { token: A, body: { name: 'JHS 3', level: 'JHS' } });
  check('class created', r.status === 201, r.data);
  const jhs3 = r.data;
  r = await call('DELETE', `/academic/classes/${p5.id}`, { token: A });
  check('cannot delete class with students', r.status === 400, r.data);

  // ─── Students & guardians ───
  section('Students');
  r = await call('GET', '/students?pageSize=10', { token: A });
  check('students paginated', r.status === 200 && r.data.total === 32 && r.data.items.length === 10, r.data);
  r = await call('POST', '/students', {
    token: H,
    body: {
      firstName: 'Kweku',
      lastName: 'Tester',
      gender: 'MALE',
      dateOfBirth: '2014-05-10',
      classId: p5.id,
      guardian: {
        firstName: 'Ato',
        lastName: 'Tester',
        phone: '+233 24 000 0001',
        email: 'ato.tester@example.com',
        relationship: 'FATHER',
      },
    },
  });
  check(
    'student created with guardian + auto ID',
    r.status === 201 && /^STD-\d{4}-\d{6}$/.test(r.data.studentId) && r.data.guardians.length === 1,
    r.data,
  );
  const newStudent = r.data;
  r = await call('GET', `/students/${newStudent.id}/id-card`, { token: A });
  check(
    'ID card payload with signed QR',
    r.status === 200 && r.data.qrPayload.startsWith('SOS1|SCH-GH-000001|'),
    r.data,
  );
  r = await call('POST', '/students/verify-qr', { token: A, body: { payload: r.data.qrPayload } });
  check('QR verifies', r.status === 201 && r.data.valid === true, r.data);
  r = await call('POST', '/students/verify-qr', {
    token: A,
    body: { payload: 'SOS1|SCH-GH-000001|STD-2026-000001|deadbeefdeadbeef' },
  });
  check('forged QR rejected', r.status === 400, r.data);
  r = await call('PATCH', `/students/${newStudent.id}`, { token: H, body: { house: 'Red' } });
  check('student update bumps version', r.status === 200 && r.data.version === 2, r.data);
  r = await call('POST', `/students/${newStudent.id}/login`, { token: A });
  check('student login created', r.status === 201 && r.data.email.endsWith('.student'), r.data);
  r = await call('GET', '/guardians?search=Tester', { token: A });
  check('guardian search', r.status === 200 && r.data.items.length === 1, r.data);

  // ─── Teacher scoping ───
  section('Teacher scoping');
  r = await call('POST', '/auth/login', {
    body: { school: 'SCH-GH-000001', email: 'teacher@brightfuture.edu.gh', password: PASSWORD },
  });
  check('teacher login by school code', r.status === 201, r.data);
  const T = r.data.accessToken;
  r = await call('GET', '/staff/my-classes', { token: T });
  check(
    'teacher sees own classes',
    r.status === 200 && r.data.classTeacherOf.length === 1 && r.data.classTeacherOf[0].name === 'Basic 5',
    r.data,
  );
  r = await call('GET', '/students', { token: T });
  check('teacher lacks STUDENT_VIEW? (Class Teacher has it)', r.status === 200, r.data);
  r = await call('POST', '/fees/payments', {
    token: T,
    body: { studentId: newStudent.id, amount: 10, method: 'CASH' },
  });
  check('teacher cannot record payments (403)', r.status === 403, r.data);
  r = await call('GET', '/dashboard/teacher', { token: T });
  check('teacher dashboard', r.status === 200 && r.data.classTeacherOf.length === 1, r.data);

  // ─── Attendance ───
  section('Attendance');
  r = await call('GET', `/attendance/register?classId=${p5.id}&date=${today}`, { token: T });
  check(
    'register lists 9 students unmarked',
    r.status === 200 && r.data.students.length === 9 && r.data.marked === false,
    r.data,
  );
  const p5Students = r.data.students;
  const records = p5Students.map((s, i) => ({
    studentId: s.id,
    status: i === 0 ? 'ABSENT' : i === 1 ? 'LATE' : 'PRESENT',
  }));
  r = await call('POST', '/attendance/mark', { token: T, body: { classId: p5.id, date: today, records } });
  check('teacher marks attendance', r.status === 201 && r.data.applied === 9, r.data);
  r = await call('POST', '/attendance/mark', {
    token: T,
    body: { classId: jhs3.id, date: today, records: [{ studentId: p5Students[0].id, status: 'PRESENT' }] },
  });
  check('teacher blocked from unassigned class', r.status === 403, r.data);
  r = await call('GET', `/attendance/summary?classId=${p5.id}`, { token: A });
  check(
    'attendance summary',
    r.status === 200 && r.data.students[0].rate !== undefined && r.data.schoolDays === 1,
    r.data,
  );
  r = await call('GET', '/attendance/daily', { token: A });
  check('daily snapshot', r.status === 200 && r.data.marked === 9 && r.data.ABSENT === 1, r.data);
  r = await call('POST', '/attendance/mark', {
    token: T,
    body: { classId: p5.id, date: '2099-01-01', records: [{ studentId: p5Students[0].id, status: 'PRESENT' }] },
  });
  check('future date rejected', r.status === 400, r.data);

  // ─── Offline sync ───
  section('Offline sync');
  r = await call('POST', '/sync/devices/register', { token: T, body: { name: 'Kwame Android', platform: 'ANDROID' } });
  check('device registered', r.status === 201, r.data);
  const deviceId = r.data.id;
  r = await call('GET', '/sync/pull', { token: T });
  check(
    'full pull scoped to teacher classes',
    r.status === 200 &&
      r.data.full &&
      r.data.classes.length >= 1 &&
      r.data.students.length >= 9 &&
      r.data.attendance.length === 9,
    r.data,
  );
  const pullTime = r.data.serverTime;
  const opId = 'op-' + Date.now();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const pushBody = {
    deviceId,
    pendingCount: 0,
    operations: [
      {
        operationId: opId,
        entity: 'attendance',
        action: 'mark',
        payload: {
          classId: p5.id,
          date: yesterday,
          records: p5Students.map((s) => ({ studentId: s.id, status: 'PRESENT' })),
        },
        clientTimestamp: new Date().toISOString(),
      },
    ],
  };
  r = await call('POST', '/sync/push', { token: T, body: pushBody });
  check(
    'offline attendance applied',
    r.status === 201 && r.data.results[0].status === 'APPLIED' && r.data.results[0].result.applied === 9,
    r.data,
  );
  r = await call('POST', '/sync/push', { token: T, body: pushBody });
  check(
    'duplicate operation ignored (idempotent)',
    r.status === 201 && r.data.results[0].status === 'DUPLICATE',
    r.data,
  );
  // stale offline edit → LATEST_WINS with older timestamp = conflict, newer = applied
  r = await call('POST', '/sync/push', {
    token: A,
    body: {
      deviceId,
      operations: [
        {
          operationId: opId + '-x',
          entity: 'student',
          action: 'update',
          payload: { id: newStudent.id, baseVersion: 1, changes: { house: 'Blue' } },
          clientTimestamp: new Date(Date.now() - 3600_000).toISOString(),
        },
      ],
    },
  });
  check('admin cannot push with teacher device (device ownership)', r.status === 404, r.data);
  r = await call('POST', '/sync/push', {
    token: T,
    body: {
      deviceId,
      operations: [
        {
          operationId: opId + '-stale',
          entity: 'student',
          action: 'update',
          payload: { id: newStudent.id, baseVersion: 1, changes: { house: 'Blue' } },
          clientTimestamp: new Date(Date.now() - 3600_000).toISOString(),
        },
      ],
    },
  });
  check(
    'stale student edit → CONFLICT (server wins under LATEST_WINS)',
    r.status === 201 && r.data.results[0].status === 'CONFLICT',
    r.data,
  );
  r = await call('POST', '/sync/push', {
    token: T,
    body: {
      deviceId,
      operations: [
        {
          operationId: opId + '-fresh',
          entity: 'student',
          action: 'update',
          payload: { id: newStudent.id, baseVersion: 2, changes: { house: 'Green' } },
          clientTimestamp: new Date().toISOString(),
        },
      ],
    },
  });
  check(
    'current-version student edit applied',
    r.status === 201 && r.data.results[0].status === 'APPLIED' && r.data.results[0].result.version === 3,
    r.data,
  );
  r = await call('GET', `/sync/pull?since=${encodeURIComponent(pullTime)}`, { token: T });
  check(
    'delta pull returns only changes',
    r.status === 200 && !r.data.full && r.data.students.length === 1 && r.data.attendance.length === 9,
    r.data,
  );
  r = await call('GET', '/sync/devices', { token: A });
  check(
    'devices dashboard',
    r.status === 200 && r.data.summary.devices === 1 && r.data.items[0].status === 'SYNCED',
    r.data,
  );
  r = await call('GET', '/sync/operations', { token: A });
  check('operations log (3 recorded; duplicate not stored)', r.status === 200 && r.data.length === 3, r.data.length);
  // MANUAL policy → open conflict → resolve
  await call('PATCH', '/school/settings', { token: A, body: { sync: { conflictPolicy: 'MANUAL' } } });
  r = await call('POST', '/sync/push', {
    token: T,
    body: {
      deviceId,
      operations: [
        {
          operationId: opId + '-manual',
          entity: 'attendance',
          action: 'mark',
          payload: { classId: p5.id, date: today, records: [{ studentId: p5Students[0].id, status: 'PRESENT' }] },
          clientTimestamp: new Date().toISOString(),
        },
      ],
    },
  });
  check(
    'MANUAL policy raises conflict',
    r.status === 201 && r.data.results[0].status === 'CONFLICT' && r.data.results[0].result.conflicts === 1,
    r.data,
  );
  r = await call('GET', '/sync/conflicts', { token: A });
  check('open conflict listed', r.status === 200 && r.data.length === 1, r.data);
  r = await call('POST', `/sync/conflicts/${r.data[0].id}/resolve`, { token: A, body: { resolution: 'CLIENT' } });
  check('conflict resolved in favour of client', r.status === 201, r.data);
  r = await call('GET', `/attendance/register?classId=${p5.id}&date=${today}`, { token: A });
  check(
    'resolution applied to attendance',
    r.data.students.find((s) => s.id === p5Students[0].id).attendance.status === 'PRESENT',
    r.data,
  );
  await call('PATCH', '/school/settings', { token: A, body: { sync: { conflictPolicy: 'LATEST_WINS' } } });

  // ─── Fees ───
  section('Fees');
  r = await call('POST', '/auth/login', {
    body: { school: 'brightfuture', email: 'accounts@brightfuture.edu.gh', password: PASSWORD },
  });
  const F = r.data.accessToken;
  r = await call('GET', '/fees/structures', { token: F });
  check('fee structures', r.status === 200 && r.data.length === 16, r.data);
  r = await call('POST', '/fees/discounts', {
    token: F,
    body: { studentId: p5Students[2].id, name: 'Scholarship', type: 'PERCENT', value: 50, reason: 'Merit' },
  });
  check('discount granted', r.status === 201, r.data);
  r = await call('POST', '/fees/invoices/generate', { token: F, body: { termId: term.id } });
  check('invoices generated for all classes', r.status === 201 && r.data.created === 33, r.data);
  r = await call('POST', '/fees/invoices/generate', { token: F, body: { termId: term.id } });
  check('regeneration skips existing', r.status === 201 && r.data.created === 0 && r.data.skipped === 33, r.data);
  r = await call('GET', `/fees/invoices?studentId=${p5Students[2].id}`, { token: F });
  check('discounted invoice (50% off 1070 = 535)', r.status === 200 && Number(r.data.items[0].total) === 535, r.data);
  r = await call('GET', `/fees/invoices?studentId=${p5Students[0].id}`, { token: F });
  const inv = r.data.items[0];
  check('boarding student invoice includes boarding line (1070+1200)', Number(inv.total) === 2270, inv);
  r = await call('GET', `/fees/invoices/${inv.id}`, { token: F });
  check(
    'invoice detail has 3 installments',
    r.status === 200 && r.data.installments.length === 3 && r.data.lines.length === 8,
    r.data,
  );
  r = await call('POST', '/fees/payments', {
    token: F,
    body: {
      studentId: p5Students[0].id,
      invoiceId: inv.id,
      amount: 1000,
      method: 'MOBILE_MONEY',
      reference: 'MM-' + Date.now(),
    },
  });
  check(
    'payment recorded with receipt number',
    r.status === 201 && /^RCP-\d{4}-\d{6}$/.test(r.data.receiptNumber) && r.data.invoice.status === 'PARTIALLY_PAID',
    r.data,
  );
  const payment = r.data;
  r = await call('GET', `/fees/invoices/${inv.id}`, { token: F });
  check(
    'installments allocated (1st paid, 2nd partial)',
    r.data.installments[0].status === 'PAID' &&
      r.data.installments[1].status === 'PARTIAL' &&
      Number(r.data.paidTotal) === 1000,
    r.data.installments,
  );
  r = await call('GET', `/fees/payments/${payment.id}/receipt.pdf`, { token: F, raw: true });
  check('receipt PDF rendered', r.status === 200 && r.ct.includes('application/pdf') && r.data.byteLength > 1500, r.ct);
  r = await call('GET', `/fees/students/${p5Students[0].id}/statement`, { token: F });
  check(
    'statement balance = 2270 - 1000',
    r.status === 200 && Number(r.data.balance) === 1270 && r.data.ledger.length === 2,
    r.data,
  );
  r = await call('POST', '/fees/payments', {
    token: F,
    body: { studentId: p5Students[0].id, invoiceId: inv.id, amount: 1270, method: 'CASH' },
  });
  check('final payment settles invoice', r.status === 201 && r.data.invoice.status === 'PAID', r.data);
  const payment2 = r.data;
  r = await call('POST', `/fees/payments/${payment2.id}/reverse`, { token: H, body: { reason: 'Cashier error' } });
  check('payment reversal (admin)', r.status === 201 && r.data.status === 'REVERSED', r.data);
  r = await call('GET', `/fees/students/${p5Students[0].id}/statement`, { token: F });
  check(
    'ledger after reversal balance = 1270',
    Number(r.data.balance) === 1270 && r.data.invoices[0].status === 'PARTIALLY_PAID',
    r.data.balance,
  );
  r = await call('GET', '/fees/summary', { token: F });
  check(
    'finance summary',
    r.status === 200 && Number(r.data.collected) === 1000 && r.data.byClass.length === 4,
    r.data,
  );
  r = await call('GET', '/dashboard/finance', { token: F });
  check('finance dashboard', r.status === 200 && r.data.topDebtors.length > 0, r.data);
  r = await call('POST', '/fees/payments/online/initiate', {
    token: F,
    body: { studentId: p5Students[0].id, amount: 50, email: 'parent@brightfuture.edu.gh' },
  });
  check('online payment needs Paystack config', r.status === 400 && r.data.code === 'PAYMENTS_NOT_CONFIGURED', r.data);

  // ─── Results ───
  section('Results');
  const eng = subjects.find((s) => s.code === 'ENG'),
    math = subjects.find((s) => s.code === 'MATH');
  const mk = async (subjectId, name, type, maxScore) =>
    (
      await call('POST', '/results/assessments', {
        token: T,
        body: { termId: term.id, classId: p5.id, subjectId, name, type, maxScore },
      })
    ).data;
  const a1 = await mk(eng.id, 'Class test 1', 'CA', 20),
    a2 = await mk(eng.id, 'End of term exam', 'EXAM', 100),
    a3 = await mk(math.id, 'Class test', 'CA', 30),
    a4 = await mk(math.id, 'Exam', 'EXAM', 100);
  check('assessments created', a1.id && a2.id && a3.id && a4.id, a1);
  r = await call('PUT', `/results/assessments/${a1.id}/marks`, {
    token: T,
    body: { marks: [{ studentId: p5Students[0].id, score: 25 }] },
  });
  check('score above max rejected', r.status === 400, r.data);
  const marksFor = (max, offset) =>
    p5Students.map((s, i) => ({
      studentId: s.id,
      score: Math.max(0, Math.min(max, Math.round(max * (0.4 + ((i + offset) % 6) * 0.1)))),
    }));
  for (const [a, max, off] of [
    [a1, 20, 0],
    [a2, 100, 1],
    [a3, 30, 2],
    [a4, 100, 3],
  ]) {
    r = await call('PUT', `/results/assessments/${a.id}/marks`, { token: T, body: { marks: marksFor(max, off) } });
  }
  check('marks saved', r.status === 200 && r.data.saved === 9, r.data);
  r = await call('POST', '/results/compute', { token: T, body: { termId: term.id, classId: p5.id } });
  check('results computed', r.status === 201 && r.data.computed === 9, r.data);
  r = await call('GET', `/results/sheets?termId=${term.id}&classId=${p5.id}`, { token: A });
  check(
    'sheets ranked with positions',
    r.status === 200 && r.data.length === 9 && r.data[0].position === 1 && r.data[0].status === 'DRAFT',
    r.data[0],
  );
  const sheet = r.data[0];
  r = await call('GET', `/results/sheets/${sheet.id}`, { token: A });
  check(
    'sheet detail: 6 subjects, 2 graded, grades assigned',
    r.status === 200 &&
      r.data.subjects.length === 6 &&
      r.data.subjects.filter((s) => s.hasMarks).length === 2 &&
      r.data.subjects.find((s) => s.code === 'ENG').grade,
    r.data.subjects,
  );
  r = await call('POST', '/results/publish', { token: H, body: { termId: term.id, classId: p5.id } });
  check('cannot publish before approval chain', r.status === 400, r.data);
  r = await call('POST', '/results/submit', { token: T, body: { termId: term.id, classId: p5.id } });
  check('teacher submits', r.status === 201 && r.data.count === 9, r.data);
  r = await call('POST', '/results/review', { token: T, body: { termId: term.id, classId: p5.id } });
  check('teacher cannot review (403)', r.status === 403, r.data);
  r = await call('POST', '/results/reject', {
    token: H,
    body: { termId: term.id, classId: p5.id, studentIds: [sheet.studentId], reason: 'Check English score' },
  });
  check('one sheet sent back', r.status === 201 && r.data.count === 1, r.data);
  r = await call('POST', '/results/submit', {
    token: T,
    body: { termId: term.id, classId: p5.id, studentIds: [sheet.studentId] },
  });
  check('resubmitted', r.status === 201 && r.data.count === 1, r.data);
  r = await call('POST', '/results/review', { token: H, body: { termId: term.id, classId: p5.id } });
  check('reviewed', r.status === 201 && r.data.count === 9, r.data);
  r = await call('POST', '/results/approve', { token: H, body: { termId: term.id, classId: p5.id } });
  check('approved', r.status === 201 && r.data.count === 9, r.data);
  r = await call('PATCH', `/results/sheets/${sheet.id}/comments`, {
    token: T,
    body: { classTeacherComment: 'Excellent work', conduct: 'Very good' },
  });
  check('class teacher comment', r.status === 200, r.data);
  r = await call('POST', '/results/publish', { token: H, body: { termId: term.id, classId: p5.id } });
  check('published', r.status === 201 && r.data.count === 9, r.data);
  r = await call('PUT', `/results/assessments/${a1.id}/marks`, {
    token: T,
    body: { marks: [{ studentId: p5Students[0].id, score: 10 }] },
  });
  check('marks locked after publish for teacher', r.status === 403, r.data);
  r = await call('GET', `/results/sheets/${sheet.id}/report-card.pdf`, { token: A, raw: true });
  check('report card PDF', r.status === 200 && r.ct.includes('application/pdf') && r.data.byteLength > 2000, r.ct);
  r = await call('GET', `/results/overview?termId=${term.id}`, { token: A });
  check('term overview', r.status === 200 && r.data.find((c) => c.classId === p5.id).byStatus.PUBLISHED === 9, r.data);

  // ─── Timetable ───
  section('Timetable');
  r = await call('GET', '/timetable/periods', { token: A });
  const periods = r.data.filter((p) => !p.isBreak);
  check('periods', r.status === 200 && periods.length === 6, r.data);
  r = await call('GET', '/academic/rooms', { token: A });
  const room = r.data[0];
  r = await call('GET', '/staff', { token: A });
  const staff1 = r.data.items.find((s) => s.employeeId === 'EMP-0001');
  r = await call('POST', '/timetable/slots', {
    token: H,
    body: { classId: p5.id, subjectId: eng.id, dayOfWeek: 1, periodId: periods[0].id, roomId: room.id },
  });
  check('slot created (teacher inherited)', r.status === 201 && r.data.teacher.id === staff1.id, r.data);
  r = await call('POST', '/timetable/slots', {
    token: H,
    body: { classId: jhs1.id, subjectId: eng.id, dayOfWeek: 1, periodId: periods[0].id },
  });
  check(
    'teacher double-booking → 409 TIMETABLE_CONFLICT',
    r.status === 409 && r.data.code === 'TIMETABLE_CONFLICT' && r.data.conflicts[0].type === 'TEACHER',
    r.data,
  );
  r = await call('POST', '/timetable/slots', {
    token: H,
    body: { classId: jhs1.id, subjectId: math.id, dayOfWeek: 1, periodId: periods[0].id, roomId: room.id },
  });
  check('room double-booking → 409', r.status === 409 && r.data.conflicts.some((c) => c.type === 'ROOM'), r.data);
  r = await call('POST', '/timetable/slots', {
    token: H,
    body: { classId: jhs1.id, subjectId: math.id, dayOfWeek: 1, periodId: periods[1].id },
  });
  check('non-conflicting slot ok', r.status === 201, r.data);
  r = await call('GET', `/timetable/class/${p5.id}`, { token: A });
  check('class timetable', r.status === 200 && r.data.length === 1, r.data);
  r = await call('GET', '/timetable/my', { token: T });
  check('teacher own timetable', r.status === 200 && r.data.length === 1, r.data);

  // ─── Canteen & inventory ───
  section('Canteen');
  r = await call('POST', '/auth/login', {
    body: { school: 'brightfuture', email: 'canteen@brightfuture.edu.gh', password: PASSWORD },
  });
  const C = r.data.accessToken;
  r = await call('GET', '/canteen/items', { token: C });
  check('canteen items', r.status === 200 && r.data.length === 5, r.data);
  const jollof = r.data.find((i) => i.name === 'Jollof rice'),
    water = r.data.find((i) => i.name === 'Sachet water');
  r = await call('POST', `/canteen/wallets/${p5Students[1].id}/topup`, {
    token: C,
    body: { amount: 30, method: 'CASH' },
  });
  check('wallet top-up', r.status === 201 && Number(r.data.wallet.balance) === 30, r.data);
  r = await call('POST', '/canteen/sales', {
    token: C,
    body: {
      studentId: p5Students[1].id,
      paymentMode: 'WALLET',
      items: [
        { itemId: jollof.id, quantity: 1 },
        { itemId: water.id, quantity: 2 },
      ],
    },
  });
  check('wallet sale deducts (30 - 14 = 16)', r.status === 201 && Number(r.data.balanceAfter) === 16, r.data);
  r = await call('POST', '/canteen/sales', {
    token: C,
    body: { studentId: p5Students[1].id, paymentMode: 'WALLET', items: [{ itemId: jollof.id, quantity: 2 }] },
  });
  check('insufficient balance rejected', r.status === 400 && r.data.code === 'INSUFFICIENT_BALANCE', r.data);
  r = await call('POST', '/canteen/sales', {
    token: C,
    body: { paymentMode: 'CASH', items: [{ itemId: water.id, quantity: 600 }] },
  });
  check('insufficient stock rejected', r.status === 400 && r.data.code === 'INSUFFICIENT_STOCK', r.data);
  r = await call('GET', `/canteen/wallets/${p5Students[1].id}`, { token: C });
  check(
    'wallet history',
    r.status === 200 && r.data.wallet.transactions.length === 2 && Number(r.data.spentToday) === 14,
    r.data,
  );
  r = await call('POST', `/canteen/items/${jollof.id}/stock`, {
    token: C,
    body: { type: 'WASTE', quantity: 70, reason: 'Spoiled' },
  });
  check('stock adjustment', r.status === 201 && r.data.stock === 9, r.data);
  r = await call('GET', '/canteen/summary', { token: C });
  check(
    'canteen summary + low stock',
    r.status === 200 && r.data.salesCount === 1 && r.data.lowStock.some((i) => i.name === 'Jollof rice'),
    r.data,
  );
  r = await call('GET', '/inventory/low-stock', { token: A });
  check(
    'inventory low stock',
    r.status === 200 && r.data.length === 1 && r.data[0].name === 'Whiteboard markers',
    r.data,
  );
  r = await call('POST', `/inventory/items/${r.data[0].id}/move`, {
    token: H,
    body: { type: 'IN', quantity: 20, reason: 'Purchase' },
  });
  check('inventory movement', r.status === 201 && r.data.quantity === 28, r.data);

  // ─── Communications ───
  section('Communications');
  r = await call('POST', '/announcements', {
    token: A,
    body: {
      title: 'Mid-term break',
      body: 'School closes Friday.',
      audienceType: 'CLASS',
      classId: p5.id,
      channels: ['IN_APP', 'SMS'],
      publish: true,
    },
  });
  check(
    'class announcement published with SMS (LOG provider)',
    r.status === 201 && r.data.publishedAt && r.data.delivery.sms.sent >= 1,
    r.data,
  );
  r = await call('POST', '/auth/login', {
    body: { school: 'brightfuture', email: 'parent@brightfuture.edu.gh', password: PASSWORD },
  });
  const G = r.data.accessToken;
  r = await call('GET', '/notifications/me', { token: G });
  check(
    'parent has notifications (results + announcement)',
    r.status === 200 && r.data.unread >= 2 && r.data.items.some((n) => n.type === 'RESULTS'),
    r.data.unread,
  );
  r = await call('POST', '/notifications/read-all', { token: G });
  check('mark all read', r.status === 201, r.data);

  // ─── Parent portal ───
  section('Parent portal');
  r = await call('GET', '/portal/overview', { token: G });
  check(
    'portal overview lists 2 children with fees + latest result',
    r.status === 200 && r.data.children.length === 2 && r.data.children[0].latestResult,
    r.data,
  );
  const child = r.data.children.find((c) => c.id === p5Students[0].id) ?? r.data.children[0];
  r = await call('GET', `/portal/children/${child.id}/attendance`, { token: G });
  check('child attendance', r.status === 200 && r.data.total >= 2, r.data);
  r = await call('GET', `/portal/children/${child.id}/results`, { token: G });
  check('child published results', r.status === 200 && r.data.length === 1, r.data);
  r = await call('GET', `/portal/children/${child.id}/results/${r.data[0].id}/report-card.pdf`, {
    token: G,
    raw: true,
  });
  check('parent downloads report card', r.status === 200 && r.ct.includes('pdf'), r.ct);
  r = await call('GET', `/portal/children/${child.id}/fees`, { token: G });
  check('child fees', r.status === 200 && r.data.invoices.length === 1, r.data);
  r = await call('GET', `/students?classId=${jhs1.id}&pageSize=1`, { token: A });
  const otherChild = r.data.items[0];
  r = await call('GET', `/portal/children/${otherChild.id}/fees`, { token: G });
  check('parent cannot see other children (403)', r.status === 403, r.data);
  r = await call('GET', '/students', { token: G });
  check('parent has no staff permissions', r.status === 403, r.data);

  // ─── Admissions ───
  section('Admissions');
  r = await call('POST', '/public/admissions/brightfuture/apply', {
    body: {
      firstName: 'Nana',
      lastName: 'Applicant',
      gender: 'FEMALE',
      dateOfBirth: '2015-02-02',
      appliedLevel: 'Primary',
      guardianName: 'Yaa Applicant',
      guardianPhone: '+233240000099',
      guardianEmail: 'yaa@example.com',
    },
  });
  check('public application', r.status === 201 && /^APP-\d{4}-\d{5}$/.test(r.data.applicationNumber), r.data);
  r = await call('GET', '/admissions', { token: H });
  check('admissions listed', r.status === 200 && r.data.total === 1, r.data);
  const app = r.data.items[0];
  r = await call('PATCH', `/admissions/${app.id}/status`, { token: H, body: { status: 'APPROVED', notes: 'Good' } });
  check('application approved', r.status === 200 && r.data.status === 'APPROVED', r.data);
  r = await call('POST', `/admissions/${app.id}/admit`, { token: H, body: { classId: p5.id } });
  check(
    'admitted → student + guardian created',
    r.status === 201 && r.data.student.studentId && r.data.student.guardians.length === 1,
    r.data,
  );

  // ─── Exports & audit & dashboards ───
  section('Exports / audit / dashboards');
  r = await call('GET', '/exports/students.csv', { token: A });
  check('students CSV', r.status === 200 && r.ct.includes('text/csv') && r.data.split('\n').length >= 35, r.ct);
  r = await call('GET', `/exports/results.csv?termId=${term.id}`, { token: A });
  check('results CSV with subject columns', r.status === 200 && r.data.includes('ENG'), r.data.slice(0, 100));
  r = await call('GET', '/audit?pageSize=5', { token: A });
  check('audit trail', r.status === 200 && r.data.total > 30, r.data);
  r = await call('GET', '/dashboard/school', { token: A });
  check(
    'school dashboard',
    r.status === 200 && r.data.counts.students === 34 && r.data.attendanceToday && r.data.fees,
    r.data,
  );
  r = await call('GET', '/dashboard/canteen', { token: C });
  check('canteen dashboard', r.status === 200, r.data);

  // ─── Subscriptions ───
  section('Subscriptions');
  r = await call('GET', '/subscription', { token: A });
  check(
    'subscription view',
    r.status === 200 && r.data.subscription.plan.code === 'PROFESSIONAL' && r.data.usage.students === 34,
    r.data,
  );
  r = await call('POST', '/subscription/change', {
    token: A,
    body: { planCode: 'ENTERPRISE', billingCycle: 'YEARLY' },
  });
  check('plan change request → pending invoice', r.status === 201 && r.data.invoice.number.startsWith('SUB-'), r.data);
  const subInv = r.data.invoice;
  r = await call('POST', `/platform/subscription-invoices/${subInv.id}/mark-paid`, {
    token: P,
    body: { reference: 'BANK-123' },
  });
  check('platform marks invoice paid → plan switched', r.status === 201 && r.data.status === 'PAID', r.data);
  r = await call('GET', '/auth/me', { token: A });
  check(
    'school now on ENTERPRISE with all features',
    r.data.subscription.planCode === 'ENTERPRISE' &&
      r.data.features.includes('API') &&
      r.data.subscription.studentLimit === 100000,
    r.data.subscription,
  );
  r = await call('POST', `/platform/schools/${school2.id}/suspend`, { token: P, body: { reason: 'Test suspension' } });
  check('platform suspends school', r.status === 201 && r.data.status === 'SUSPENDED', r.data);
  r = await call('GET', '/academic/current', { token: school2.token });
  check('suspended school blocked (TENANT_SUSPENDED)', r.status === 403 && r.data.code === 'TENANT_SUSPENDED', r.data);
  r = await call('POST', `/platform/schools/${school2.id}/activate`, { token: P, body: {} });
  r = await call('POST', `/platform/schools/${school2.id}/support-session`, {
    token: P,
    body: { reason: 'Investigating a login issue' },
  });
  check('support session token issued', r.status === 201 && r.data.accessToken, r.data);
  r = await call('GET', '/auth/me', { token: r.data.accessToken });
  check(
    'support session acts inside school (flagged)',
    r.status === 200 && r.data.isSupportSession === true && r.data.tenant.slug === slug,
    r.data,
  );
  r = await call('GET', '/platform/audit?action=SUPPORT_SESSION', { token: P });
  check('support session audited', r.status === 200 && r.data.total >= 1, r.data);
  r = await call('GET', '/platform/sync-overview', { token: P });
  check('platform sync overview', r.status === 200 && r.data.length === 1 && r.data[0].devices === 1, r.data);

  // ─── Extended modules ───
  section('Discipline');
  r = await call('POST', '/discipline/incidents', {
    token: T,
    body: {
      studentId: p5Students[2].id,
      date: today,
      category: 'LATENESS',
      severity: 'MINOR',
      description: 'Late to assembly',
      points: 1,
      notifyParent: true,
    },
  });
  check('teacher logs incident', r.status === 201 && r.data.status === 'OPEN', r.data);
  const incidentId = r.data.id;
  r = await call('PATCH', `/discipline/incidents/${incidentId}`, {
    token: H,
    body: { status: 'RESOLVED', actionTaken: 'Warning issued' },
  });
  check('incident resolved', r.status === 200 && r.data.status === 'RESOLVED' && r.data.resolvedAt, r.data);
  r = await call('GET', '/discipline/overview', { token: A });
  check('discipline overview', r.status === 200 && r.data.byCategory.length >= 1, r.data);
  r = await call('GET', `/discipline/students/${p5Students[2].id}/summary`, { token: A });
  check('student behaviour summary', r.status === 200 && r.data.totalPoints >= 1, r.data);

  section('Events');
  r = await call('POST', '/events', {
    token: A,
    body: {
      title: 'Smoke test meeting',
      type: 'MEETING',
      startAt: new Date(Date.now() + 86400000).toISOString(),
      audienceType: 'PARENTS',
      notify: true,
    },
  });
  check('event created + parents notified', r.status === 201, r.data);
  const eventId = r.data.id;
  r = await call('GET', '/events/upcoming', { token: G });
  check('parent sees upcoming events', r.status === 200 && r.data.some((e) => e.id === eventId), r.data);
  r = await call('GET', `/events/calendar?year=${new Date().getUTCFullYear()}&month=${new Date().getUTCMonth() + 1}`, {
    token: A,
  });
  check('month calendar', r.status === 200 && r.data.days, r.data);
  r = await call('POST', '/events', { token: G, body: { title: 'x', startAt: new Date().toISOString() } });
  check('parent cannot create events', r.status === 403, r.data);

  section('Assignments');
  r = await call('POST', '/assignments', {
    token: T,
    body: {
      classId: p5.id,
      subjectId: eng.id,
      title: 'Smoke homework',
      instructions: 'Write an essay',
      dueAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      maxScore: 10,
    },
  });
  check(
    'teacher creates assignment (submission rows for every student)',
    r.status === 201 && r.data.total === 10,
    r.data,
  );
  const assignmentId = r.data.id;
  r = await call('GET', `/portal/children/${child.id}/assignments`, { token: G });
  check(
    'parent sees child assignments',
    r.status === 200 && r.data.some((a) => a.assignmentId === assignmentId),
    r.data,
  );
  r = await call('POST', `/portal/children/${child.id}/assignments/${assignmentId}/submit`, {
    token: G,
    body: { note: 'Done' },
  });
  check('submission marked', r.status === 201 && r.data.status === 'SUBMITTED', r.data);
  r = await call('PUT', `/assignments/${assignmentId}/grades`, {
    token: T,
    body: { items: [{ studentId: child.id, score: 8, feedback: 'Well done' }] },
  });
  check(
    'teacher grades',
    r.status === 200 && r.data.submissions.find((x) => x.studentId === child.id).status === 'GRADED',
    r.data,
  );
  r = await call('PUT', `/assignments/${assignmentId}/grades`, {
    token: T,
    body: { items: [{ studentId: child.id, score: 11 }] },
  });
  check('score above max rejected', r.status === 400, r.data);
  r = await call('GET', '/assignments/teacher-summary', { token: T });
  check('teacher assignment summary', r.status === 200 && r.data.dueSoon.length >= 1, r.data);

  section('Library');
  r = await call('GET', '/library/books', { token: A });
  check('catalogue', r.status === 200 && r.data.total >= 7, r.data);
  const book = r.data.items.find((b) => b.copiesAvailable > 1);
  r = await call('POST', '/library/loans', { token: H, body: { bookId: book.id, studentId: p5Students[4].id } });
  check('book borrowed', r.status === 201 && r.data.status === 'BORROWED', r.data);
  const loanId = r.data.id;
  r = await call('GET', '/library/books?search=' + encodeURIComponent(book.title.slice(0, 8)), { token: A });
  check(
    'copies decremented',
    r.data.items.find((b) => b.id === book.id).copiesAvailable === book.copiesAvailable - 1,
    r.data,
  );
  r = await call('POST', `/library/loans/${loanId}/return`, { token: H, body: {} });
  check('book returned', r.status === 201 && r.data.status === 'RETURNED', r.data);
  r = await call('GET', '/library/summary', { token: A });
  check('library summary with overdue', r.status === 200 && r.data.overdueCount >= 1, r.data);
  r = await call('GET', '/library/loans?status=OVERDUE', { token: A });
  const overdueStudent = r.data.items[0]?.studentId;
  r = await call('POST', '/library/loans', { token: H, body: { bookId: book.id, studentId: overdueStudent } });
  check('student with overdue book blocked', r.status === 400, r.data);

  section('Transport');
  r = await call('GET', '/transport/routes', { token: A });
  check('routes with occupancy', r.status === 200 && r.data.length === 2 && r.data[0].riders >= 1, r.data);
  const route = r.data[0];
  r = await call('POST', '/transport/assignments', {
    token: H,
    body: { studentId: p5Students[7].id, routeId: route.id, stopId: route.stops[0].id },
  });
  check('student assigned to route', r.status === 201, r.data);
  r = await call('GET', `/portal/children/${child.id}/transport`, { token: G });
  check('parent sees transport', r.status === 200, r.data);
  r = await call('DELETE', `/transport/assignments/${p5Students[7].id}`, { token: H });
  check('student removed from route', r.status === 200, r.data);

  section('Health');
  r = await call('PUT', `/health/students/${child.id}`, {
    token: H,
    body: { bloodGroup: 'A+', allergies: 'None known' },
  });
  check('health record upserted', r.status === 200 && r.data.bloodGroup === 'A+', r.data);
  r = await call('POST', '/health/visits', {
    token: H,
    body: { studentId: child.id, complaint: 'Stomach ache', treatment: 'Rested', notifyParent: true },
  });
  check('visit logged + parent notified', r.status === 201, r.data);
  r = await call('GET', `/portal/children/${child.id}/health`, { token: G });
  check(
    'parent sees health visits',
    r.status === 200 && r.data.visits.length >= 1 && r.data.record.bloodGroup === 'A+',
    r.data,
  );
  r = await call('GET', '/health/summary', { token: T });
  check('teacher can view clinic summary (HEALTH_VIEW)', r.status === 200, r.data);
  r = await call('POST', '/health/visits', { token: T, body: { studentId: child.id, complaint: 'x' } });
  check('teacher cannot log visits (403)', r.status === 403, r.data);

  section('Messaging');
  r = await call('GET', '/messages/contacts', { token: G });
  check('parent contacts = teachers + office', r.status === 200 && r.data.length >= 2, r.data);
  const teacherContact = r.data.find((c) => c.name === 'Kwame Boateng') ?? r.data.find((c) => c.userType === 'TEACHER');
  r = await call('POST', '/messages/threads', {
    token: G,
    body: { participantIds: [teacherContact.id], body: 'Hello teacher, smoke test' },
  });
  check('parent starts conversation', r.status === 201 && r.data.messages.length >= 1, r.data);
  const threadId = r.data.id;
  r = await call('GET', '/messages/unread-count', { token: T });
  check('teacher has unread', r.status === 200 && r.data.count >= 1, r.data);
  r = await call('POST', `/messages/threads/${threadId}`, { token: T, body: { body: 'Received, thank you.' } });
  check('teacher replies', r.status === 201, r.data);
  r = await call('GET', `/messages/threads/${threadId}`, { token: C });
  check('outsider cannot read thread', r.status === 403, r.data);
  r = await call('POST', '/messages/threads', {
    token: T,
    body: { classId: p5.id, subject: 'Class notice', body: 'Reminder: trip on Friday' },
  });
  check('teacher starts class thread', r.status === 201 && r.data.participants.length >= 1, r.data);

  section('HR');
  r = await call('POST', '/hr/leave', {
    token: T,
    body: {
      type: 'ANNUAL',
      startDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      endDate: new Date(Date.now() + 32 * 86400000).toISOString(),
      reason: 'Family',
    },
  });
  check('teacher requests leave', r.status === 201 && r.data.status === 'PENDING' && r.data.days >= 1, r.data);
  const leaveId = r.data.id;
  r = await call('POST', `/hr/leave/${leaveId}/review`, { token: T, body: { status: 'APPROVED' } });
  check('teacher cannot approve leave', r.status === 403, r.data);
  r = await call('POST', `/hr/leave/${leaveId}/review`, { token: H, body: { status: 'APPROVED', note: 'Enjoy' } });
  check('headmaster approves leave', r.status === 201 && r.data.status === 'APPROVED', r.data);
  r = await call('GET', '/hr/payroll', { token: H });
  check('payroll history', r.status === 200 && r.data.length >= 1, r.data);
  const nextPeriod = (() => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d.toISOString().slice(0, 7);
  })();
  r = await call('POST', '/hr/payroll', { token: H, body: { period: nextPeriod } });
  check(
    'payroll draft from salaries',
    r.status === 201 && r.data.items.length >= 2 && Number(r.data.totalNet) > 0,
    r.data,
  );
  const runId = r.data.id;
  r = await call('PUT', `/hr/payroll/${runId}/items`, {
    token: H,
    body: { items: [{ staffId: staff1.id, basic: 2800, allowances: 100, deductions: 50 }] },
  });
  check(
    'payroll item updated (net 2850)',
    r.status === 200 && Number(r.data.items.find((i) => i.staffId === staff1.id).net) === 2850,
    r.data,
  );
  r = await call('POST', `/hr/payroll/${runId}/pay`, { token: H });
  check('cannot pay before approval', r.status === 400, r.data);
  r = await call('POST', `/hr/payroll/${runId}/approve`, { token: H });
  check('payroll approved', r.status === 201 && r.data.status === 'APPROVED', r.data);
  r = await call('GET', `/hr/payroll/${runId}/payslips/${staff1.id}`, { token: T });
  check('teacher views own payslip', r.status === 200 && Number(r.data.net) === 2850, r.data);

  section('Reports & data ownership');
  r = await call('GET', '/reports/finance', { token: A });
  check('finance ageing report', r.status === 200 && r.data.ageing && r.data.topDefaulters.length >= 1, r.data);
  r = await call('GET', '/reports/attendance', { token: A });
  check('attendance report', r.status === 200 && r.data.byClass.length === 5, r.data);
  r = await call('GET', `/reports/academic?termId=${term.id}`, { token: A });
  check('academic report', r.status === 200 && r.data.sheets === 9, r.data);
  r = await call('GET', '/reports/staff', { token: A });
  check('staff workload report', r.status === 200 && r.data.teachers.length >= 2, r.data);
  r = await call('GET', '/analytics/enrollment', { token: A });
  check('analytics enrollment', r.status === 200, r.data);
  r = await call('GET', '/data/summary', { token: A });
  check(
    'data summary (tables & counts)',
    r.status === 200 && (r.data.totalRecords ?? r.data.tables?.length) > 0,
    r.data,
  );
  r = await call('GET', '/data/export.zip?format=ALL', { token: A, raw: true });
  check(
    'school downloads full backup ZIP',
    r.status === 200 && r.ct.includes('zip') && r.data.byteLength > 20000,
    r.ct,
  );
  r = await call('GET', '/data/export.zip', { token: T, raw: true });
  check('teacher cannot download backup', r.status === 403, r.status);
  r = await call('GET', `/platform/schools/${demoTenantId}/export.zip`, { token: P, raw: true });
  check('platform downloads a school backup', r.status === 200 && r.ct.includes('zip'), r.ct);
  r = await call('GET', '/data/exports', { token: A });
  check('export history recorded', r.status === 200 && r.data.length >= 1, r.data);

  section('Printable documents');
  for (const [name, path, tok] of [
    ['invoice PDF', `/documents/invoices/${inv.id}.pdf`, F],
    ['statement PDF', `/documents/students/${p5Students[0].id}/statement.pdf`, F],
    ['class list PDF', `/documents/classes/${p5.id}/list.pdf`, A],
    ['attendance register PDF', `/documents/classes/${p5.id}/register.pdf`, T],
    ['batch report cards PDF', `/documents/results/report-cards.pdf?termId=${term.id}&classId=${p5.id}`, A],
    ['transcript PDF', `/documents/students/${p5Students[0].id}/transcript.pdf`, A],
    ['ID card sheet PDF', `/documents/students/id-cards.pdf?classId=${p5.id}`, A],
    ['payslip PDF (own)', `/documents/payroll/${runId}/payslips/${staff1.id}.pdf`, T],
    ['class timetable PDF', `/documents/timetable/class/${p5.id}.pdf`, A],
  ]) {
    r = await call('GET', path, { token: tok, raw: true });
    check(name, r.status === 200 && r.ct.includes('pdf') && r.data.byteLength > 1000, `${r.status} ${r.ct}`);
  }
  r = await call('GET', `/documents/payroll/${runId}/payslips/${staff1.id}.pdf`, { token: C, raw: true });
  check("canteen manager cannot open a teacher's payslip", r.status === 403 || r.status === 404, r.status);

  section('Demo accounts');
  r = await call('GET', '/public/demo-accounts');
  check(
    'demo accounts listed for the login page',
    r.status === 200 &&
      r.data.enabled &&
      r.data.accounts.length >= 13 &&
      r.data.platform &&
      r.data.school.slug === 'brightfuture',
    r.data,
  );
  // Login is rate-limited to 30/min per IP (shared-NAT schools), so only the new roles are exercised here (the others log in earlier in this suite).
  const demoTokens = {};
  for (const email of ['proprietor@', 'headmaster@', 'formmaster@', 'nurse@', 'librarian@', 'hr@', 'student@']) {
    const l = await call('POST', '/auth/login', {
      body: { school: 'brightfuture', email: `${email}brightfuture.edu.gh`, password: r.data.password },
    });
    check(`demo login works: ${email}brightfuture.edu.gh`, l.status === 201 && l.data.accessToken, l.data);
    demoTokens[email] = l.data.accessToken;
  }
  r = await call('GET', '/portal/overview', { token: demoTokens['student@'] });
  check(
    'student portal linked to a student record',
    r.status === 200 && r.data.children.length === 1 && r.data.children[0].studentId,
    r.data,
  );
  r = await call('GET', '/health/summary', { token: demoTokens['nurse@'] });
  check('nurse can open the clinic', r.status === 200, r.data);
  r = await call('GET', '/hr/payroll', { token: demoTokens['hr@'] });
  check('HR officer can open payroll', r.status === 200, r.data);
  r = await call('GET', '/library/summary', { token: demoTokens['librarian@'] });
  check('librarian can open the library', r.status === 200, r.data);
  r = await call('GET', '/dashboard/school', { token: demoTokens['headmaster@'] });
  check('headmaster sees the school dashboard', r.status === 200 && r.data.counts, r.data);
  r = await call('GET', '/subscription', { token: demoTokens['headmaster@'] });
  check("headmaster cannot manage the subscription (no SUBSCRIPTION_MANAGE)", r.status === 403, r.status);
  r = await call('GET', '/dashboard/school', { token: demoTokens['proprietor@'] });
  check('proprietor sees the school dashboard', r.status === 200 && r.data.counts, r.data);
  r = await call('GET', '/subscription', { token: demoTokens['proprietor@'] });
  check('proprietor can manage the subscription (owner-only permission)', r.status === 200 && r.data.usage, r.data);
  r = await call('GET', '/academic/classes', { token: demoTokens['formmaster@'] });
  check(
    'form master is class teacher of JHS 1',
    r.status === 200 && r.data.some((c) => c.name === 'JHS 1' && c.classTeacher),
    r.data,
  );

  // ─── Cross-tenant isolation ───
  section('Tenant isolation');
  r = await call('GET', '/students', { token: school2.token });
  check('school 2 sees 0 students', r.status === 200 && r.data.total === 0, r.data);
  r = await call('GET', `/students/${newStudent.id}`, { token: school2.token });
  check('school 2 cannot fetch school 1 student by id', r.status === 404, r.data);
  r = await call('GET', `/fees/invoices/${inv.id}`, { token: school2.token });
  check('school 2 cannot fetch school 1 invoice', r.status === 404, r.data);
  r = await call('GET', `/academic/classes/${p5.id}`, { token: school2.token });
  check('school 2 cannot fetch school 1 class', r.status === 404, r.data);
  r = await call('DELETE', `/academic/classes/${p5.id}`, {
    token: school2.token,
  });
  check('school 2 cannot write into school 1 class (404)', r.status === 404, r.data);
  r = await call('GET', '/platform/stats', { token: A });
  check('school admin cannot reach platform routes', r.status === 403, r.data);
  r = await call('GET', '/students', { token: P });
  check('platform admin cannot reach school routes without support session', r.status === 403, r.data);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('Failures:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
})().catch((e) => {
  console.error('SMOKE CRASH', e);
  process.exit(1);
});
