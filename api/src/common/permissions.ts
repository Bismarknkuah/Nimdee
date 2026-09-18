/** Granular permission catalogue. Roles are per-school and fully customisable. */
export const PERMISSION_GROUPS: Record<string, string[]> = {
  School: [
    'SCHOOL_MANAGE',
    'SETTINGS_MANAGE',
    'WEBSITE_MANAGE',
    'USERS_MANAGE',
    'ROLES_MANAGE',
    'AUDIT_VIEW',
    'SUBSCRIPTION_MANAGE',
    'SYNC_MANAGE',
  ],
  Academics: ['ACADEMIC_MANAGE', 'TIMETABLE_VIEW', 'TIMETABLE_MANAGE'],
  Students: [
    'STUDENT_VIEW',
    'STUDENT_CREATE',
    'STUDENT_EDIT',
    'STUDENT_DELETE',
    'GUARDIAN_MANAGE',
    'ADMISSIONS_VIEW',
    'ADMISSIONS_MANAGE',
  ],
  Staff: ['STAFF_VIEW', 'STAFF_MANAGE'],
  Attendance: ['ATTENDANCE_VIEW', 'ATTENDANCE_MARK'],
  Results: ['RESULT_VIEW', 'RESULT_ENTER', 'RESULT_REVIEW', 'RESULT_APPROVE', 'RESULT_PUBLISH'],
  Finance: ['FEES_VIEW', 'FEES_MANAGE', 'INVOICE_CREATE', 'PAYMENT_RECORD', 'REFUND_APPROVE', 'DISCOUNT_MANAGE'],
  Canteen: ['CANTEEN_VIEW', 'CANTEEN_MANAGE', 'CANTEEN_SELL', 'WALLET_TOPUP'],
  Inventory: ['INVENTORY_VIEW', 'INVENTORY_MANAGE'],
  Communication: ['ANNOUNCEMENT_MANAGE', 'MESSAGES_SEND'],
  Discipline: ['DISCIPLINE_VIEW', 'DISCIPLINE_MANAGE'],
  Events: ['EVENTS_MANAGE'],
  Assignments: ['ASSIGNMENTS_VIEW', 'ASSIGNMENTS_MANAGE'],
  Library: ['LIBRARY_VIEW', 'LIBRARY_MANAGE'],
  Transport: ['TRANSPORT_VIEW', 'TRANSPORT_MANAGE'],
  Health: ['HEALTH_VIEW', 'HEALTH_MANAGE'],
  HR: ['LEAVE_REQUEST', 'HR_MANAGE', 'PAYROLL_MANAGE'],
  Reports: ['REPORTS_VIEW', 'EXPORT_DATA', 'BACKUP_DOWNLOAD'],
};

export const ALL_PERMISSIONS: string[] = Object.values(PERMISSION_GROUPS).flat();

const TEACHER = [
  'STUDENT_VIEW',
  'ATTENDANCE_VIEW',
  'ATTENDANCE_MARK',
  'RESULT_VIEW',
  'RESULT_ENTER',
  'TIMETABLE_VIEW',
  'ASSIGNMENTS_VIEW',
  'ASSIGNMENTS_MANAGE',
  'DISCIPLINE_VIEW',
  'DISCIPLINE_MANAGE',
  'MESSAGES_SEND',
  'LEAVE_REQUEST',
  'LIBRARY_VIEW',
  'HEALTH_VIEW',
];

/**
 * "Operational" permissions: actually creating, editing or recording something day to day, such as
 * enrolling a student, marking attendance, taking a payment or selling at the canteen counter. These
 * stay with the specific staff role responsible for that job (Class Teacher, Accountant, Canteen
 * Manager, HR Officer...). School Admin configures the school; Proprietor oversees it; neither is
 * meant to be doing this hands-on work themselves, so both are built by excluding this list rather
 * than granting it.
 */
const OPERATIONAL_PERMISSIONS = [
  'TIMETABLE_MANAGE',
  'STUDENT_CREATE',
  'STUDENT_EDIT',
  'STUDENT_DELETE',
  'GUARDIAN_MANAGE',
  'ADMISSIONS_MANAGE',
  'STAFF_MANAGE',
  'ATTENDANCE_MARK',
  'RESULT_ENTER',
  'RESULT_REVIEW',
  'RESULT_APPROVE',
  'RESULT_PUBLISH',
  'INVOICE_CREATE',
  'PAYMENT_RECORD',
  'REFUND_APPROVE',
  'DISCOUNT_MANAGE',
  'CANTEEN_SELL',
  'WALLET_TOPUP',
  'INVENTORY_MANAGE',
  'DISCIPLINE_MANAGE',
  'ASSIGNMENTS_MANAGE',
  'LIBRARY_MANAGE',
  'TRANSPORT_MANAGE',
  'HEALTH_MANAGE',
  'HR_MANAGE',
  'PAYROLL_MANAGE',
];
/** Every read-only permission, plus exporting a report (still just looking at data, not changing it). */
const VIEW_AND_OVERSIGHT_PERMISSIONS = [...ALL_PERMISSIONS.filter((p) => p.endsWith('_VIEW')), 'EXPORT_DATA'];

/** System roles created for every new school. Schools can add their own roles on top. */
export const SYSTEM_ROLES: Record<string, { description: string; permissions: string[] }> = {
  'School Admin': {
    description: 'Configures and manages the school (roles, features, settings) without entering day-to-day data',
    permissions: ALL_PERMISSIONS.filter((p) => !OPERATIONAL_PERMISSIONS.includes(p)),
  },
  Proprietor: {
    description: 'School owner: oversight and reporting on every activity, plus billing; no data entry',
    permissions: [...VIEW_AND_OVERSIGHT_PERMISSIONS, 'SUBSCRIPTION_MANAGE'],
  },
  Headmaster: {
    description: 'Head of school: oversight of academics, finance and operations',
    permissions: ALL_PERMISSIONS.filter(
      (p) => !['USERS_MANAGE', 'ROLES_MANAGE', 'SUBSCRIPTION_MANAGE', 'BACKUP_DOWNLOAD'].includes(p),
    ),
  },
  'Academic Head': {
    description: 'Manages academic structure, timetable and result review',
    permissions: [
      'ACADEMIC_MANAGE',
      'TIMETABLE_VIEW',
      'TIMETABLE_MANAGE',
      'STUDENT_VIEW',
      'STUDENT_EDIT',
      'STAFF_VIEW',
      'ATTENDANCE_VIEW',
      'ATTENDANCE_MARK',
      'RESULT_VIEW',
      'RESULT_ENTER',
      'RESULT_REVIEW',
      'REPORTS_VIEW',
      'DISCIPLINE_VIEW',
      'DISCIPLINE_MANAGE',
      'EVENTS_MANAGE',
      'ASSIGNMENTS_VIEW',
      'ASSIGNMENTS_MANAGE',
      'MESSAGES_SEND',
      'LIBRARY_VIEW',
      'HEALTH_VIEW',
      'EXPORT_DATA',
    ],
  },
  Accountant: {
    description: 'Fees, invoices, payments and financial reports',
    permissions: [
      'STUDENT_VIEW',
      'STAFF_VIEW',
      'FEES_VIEW',
      'FEES_MANAGE',
      'INVOICE_CREATE',
      'PAYMENT_RECORD',
      'DISCOUNT_MANAGE',
      'WALLET_TOPUP',
      'CANTEEN_VIEW',
      'INVENTORY_VIEW',
      'TRANSPORT_VIEW',
      'REPORTS_VIEW',
      'EXPORT_DATA',
      'PAYROLL_MANAGE',
      'MESSAGES_SEND',
      'LEAVE_REQUEST',
    ],
  },
  Teacher: { description: 'Attendance, marks and timetable for assigned classes', permissions: TEACHER },
  'Class Teacher': {
    description: 'Teacher plus class administration',
    permissions: [...TEACHER, 'STUDENT_EDIT', 'GUARDIAN_MANAGE'],
  },
  'Canteen Manager': {
    description: 'Canteen POS, stock and wallets',
    permissions: ['STUDENT_VIEW', 'CANTEEN_VIEW', 'CANTEEN_MANAGE', 'CANTEEN_SELL', 'WALLET_TOPUP'],
  },
  Cashier: { description: 'Canteen point of sale only', permissions: ['STUDENT_VIEW', 'CANTEEN_VIEW', 'CANTEEN_SELL'] },
  Nurse: {
    description: 'School clinic: health records and visits',
    permissions: ['STUDENT_VIEW', 'HEALTH_VIEW', 'HEALTH_MANAGE', 'MESSAGES_SEND', 'LEAVE_REQUEST'],
  },
  Librarian: {
    description: 'Library catalogue and loans',
    permissions: ['STUDENT_VIEW', 'STAFF_VIEW', 'LIBRARY_VIEW', 'LIBRARY_MANAGE', 'MESSAGES_SEND', 'LEAVE_REQUEST'],
  },
  'HR Officer': {
    description: 'Staff records, leave approvals and payroll',
    permissions: [
      'STAFF_VIEW',
      'STAFF_MANAGE',
      'HR_MANAGE',
      'PAYROLL_MANAGE',
      'LEAVE_REQUEST',
      'MESSAGES_SEND',
      'REPORTS_VIEW',
    ],
  },
  Parent: { description: 'Parent portal (scoped to own children)', permissions: ['MESSAGES_SEND'] },
  Student: { description: 'Student portal (own records only)', permissions: ['MESSAGES_SEND'] },
};
