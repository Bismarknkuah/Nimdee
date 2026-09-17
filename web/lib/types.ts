/**
 * Shared TypeScript types for API responses used by the web app.
 * They mirror the shapes returned by api/src/**\/*.service.ts (see docs/API.md and docs/ERD.md).
 * Money values arrive as numbers (the API serialises Prisma Decimals); dates as ISO-8601 strings.
 */

export type ID = string;
export type ISODate = string;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ─────────────────────────── Session ───────────────────────────
export type UserType = 'STAFF' | 'TEACHER' | 'PARENT' | 'STUDENT';
export type Feature =
  | 'ACADEMICS'
  | 'ATTENDANCE'
  | 'OFFLINE_SYNC'
  | 'FEES'
  | 'RESULTS'
  | 'TIMETABLE'
  | 'CANTEEN'
  | 'PARENT_PORTAL'
  | 'WEBSITE'
  | 'CUSTOM_DOMAIN'
  | 'COMMUNICATIONS'
  | 'INVENTORY'
  | 'ANALYTICS'
  | 'API'
  | 'DISCIPLINE'
  | 'EVENTS'
  | 'ASSIGNMENTS'
  | 'LIBRARY'
  | 'TRANSPORT'
  | 'HEALTH'
  | 'MESSAGING'
  | 'HR';

export interface TenantSnapshot {
  id: ID;
  code: string;
  slug: string;
  name: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily?: string | null;
  currency: string;
  timezone: string;
  features: Feature[];
  plan: { code: string; name: string; studentLimit: number };
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'GRACE' | 'SUSPENDED' | 'CANCELLED';
  settings: SchoolSettings;
}

export interface Me {
  user: {
    id: ID;
    email: string;
    firstName: string;
    lastName: string;
    userType: UserType;
    avatarUrl?: string | null;
    mustChangePassword: boolean;
  };
  tenant: TenantSnapshot | null;
  roles: string[];
  permissions: string[];
  links: { staffId?: ID; guardianId?: ID; studentId?: ID };
  platform?: { id: ID; role: 'SUPER_ADMIN' | 'SUPPORT' } | null;
}

// ─────────────────────────── Rules engine ───────────────────────────
export interface GradeBand {
  grade: string;
  min: number;
  max: number;
  remark: string;
}
export interface SchoolSettings {
  academic: {
    caWeight: number;
    examWeight: number;
    passMark: number;
    promotionAverage: number;
    gradingScheme: GradeBand[];
    resultApprovalLevels: Array<'REVIEW' | 'APPROVE'>;
    showPosition: boolean;
  };
  attendance: { minimumAttendancePercent: number; lateAfter?: string | null; notifyParentsOnAbsence: boolean };
  finance: {
    invoicePrefix: string;
    receiptPrefix: string;
    paymentGraceDays: number;
    defaultInstallments: number;
    allowInstallments: boolean;
    allowPartialPayments: boolean;
    siblingDiscountPercent: number;
    lateFeePercent: number;
    paymentProvider: 'NONE' | 'PAYSTACK';
    paystackSecretKeySet?: boolean;
  };
  sync: {
    conflictPolicy: 'LATEST_WINS' | 'SERVER_WINS' | 'MANUAL';
    attendanceWindowDays: number;
    allowOfflineStudentEdits: boolean;
  };
  canteen: { defaultDailyLimit: number; allowNegativeStock: boolean };
  communication: { smsEnabled: boolean; smsSenderId?: string | null };
}

// ─────────────────────────── Academics & people ───────────────────────────
export interface AcademicYear {
  id: ID;
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  isCurrent: boolean;
  terms: Term[];
}
export interface Term {
  id: ID;
  name: string;
  sequence: number;
  startDate: ISODate;
  endDate: ISODate;
  examStart?: ISODate | null;
  examEnd?: ISODate | null;
  isCurrent: boolean;
  academicYear?: { id: ID; name: string };
}
export interface SchoolClass {
  id: ID;
  name: string;
  level: string;
  stream?: string | null;
  capacity?: number | null;
  classTeacherId?: ID | null;
  classTeacher?: StaffLite | null;
  studentCount?: number;
  subjectCount?: number;
}
export interface Subject {
  id: ID;
  name: string;
  code: string;
  isCore: boolean;
}
export interface ClassSubject {
  id: ID;
  classId: ID;
  subjectId: ID;
  teacherId?: ID | null;
  subject: Subject;
  teacher?: StaffLite | null;
}
export interface StaffLite {
  id: ID;
  employeeId?: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  position?: string | null;
}
export interface Staff extends StaffLite {
  gender?: 'MALE' | 'FEMALE' | null;
  email?: string | null;
  staffType: 'TEACHING' | 'NON_TEACHING';
  department?: string | null;
  employmentDate?: ISODate | null;
  status: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED';
  basicSalary?: number | null;
  user?: { id: ID; email: string; isActive: boolean } | null;
  roles?: string[];
  classTeacherOf?: Array<{ id: ID; name: string }>;
  classSubjects?: Array<{ id: ID; subject: Subject; class: { id: ID; name: string } }>;
}
export interface Guardian {
  id: ID;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  occupation?: string | null;
  address?: string | null;
  user?: { id: ID; email: string; isActive: boolean } | null;
}
export interface Student {
  id: ID;
  studentId: string;
  firstName: string;
  lastName: string;
  otherNames?: string | null;
  gender: 'MALE' | 'FEMALE';
  dateOfBirth: ISODate;
  photoUrl?: string | null;
  classId?: ID | null;
  class?: { id: ID; name: string; classTeacher?: StaffLite | null } | null;
  house?: string | null;
  isBoarding: boolean;
  admissionDate: ISODate;
  status: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'TRANSFERRED' | 'SUSPENDED';
  medicalNotes?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  balance?: number;
  guardians?: Array<{ id: ID; relationship: string; isPrimary: boolean; guardian: Guardian }>;
}

// ─────────────────────────── Attendance & sync ───────────────────────────
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'SICK';
export interface AttendanceRecord {
  id: ID;
  studentId: ID;
  classId: ID;
  date: ISODate;
  status: AttendanceStatus;
  note?: string | null;
  source: 'WEB' | 'OFFLINE' | 'QR';
  version: number;
}
export interface Device {
  id: ID;
  name: string;
  platform: string;
  isActive: boolean;
  status: 'ONLINE' | 'OFFLINE';
  pendingCount: number;
  failed7d: number;
  lastSeenAt?: ISODate | null;
  lastSyncAt?: ISODate | null;
  user?: { name: string } | null;
}
export interface SyncConflict {
  id: ID;
  entity: string;
  entityId: ID;
  status: 'OPEN' | 'RESOLVED';
  serverValue: unknown;
  clientValue: unknown;
  createdAt: ISODate;
}

// ─────────────────────────── Finance ───────────────────────────
export type InvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'MOBILE_MONEY' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'ONLINE';
export interface InvoiceLine {
  id: ID;
  description: string;
  amount: number;
  discount: number;
  categoryId?: ID | null;
}
export interface Installment {
  id: ID;
  sequence: number;
  dueDate: ISODate;
  amount: number;
  paidAmount: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';
}
export interface Invoice {
  id: ID;
  number: string;
  status: InvoiceStatus;
  subtotal: number;
  discountTotal: number;
  total: number;
  paidTotal: number;
  balance: number;
  issuedAt: ISODate;
  dueDate: ISODate;
  termId: ID;
  academicYearId: ID;
  term?: Term;
  academicYear?: AcademicYear;
  student: Student;
  lines: InvoiceLine[];
  installments: Installment[];
  payments: Payment[];
}
export interface Payment {
  id: ID;
  receiptNumber?: string | null;
  amount: number;
  method: PaymentMethod;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REVERSED';
  purpose: 'FEES' | 'WALLET';
  reference?: string | null;
  provider?: string | null;
  providerRef?: string | null;
  paidAt: ISODate;
  recordedByName?: string | null;
  payerEmail?: string | null;
  notes?: string | null;
  reversedAt?: ISODate | null;
  reversalReason?: string | null;
  student: Student;
  invoice?: { id: ID; number: string; status: InvoiceStatus } | null;
}
export interface FeeSummary {
  invoiced: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
  overdueCount: number;
  today?: number;
}
export interface FinanceReport {
  ageing: Record<'current' | '1-30' | '31-60' | '61-90' | '90+', number>;
  totalOutstanding: number;
  collectionsByMonth: Array<{ month: string; fees: number; wallet: number }>;
  byMethod: Array<{ method: PaymentMethod; amount: number }>;
  byCategory: Array<{ category: string; billed: number; discounts: number }>;
  topDefaulters: Array<Student & { balance: number; invoices: number; oldestDays: number }>;
}

// ─────────────────────────── Results ───────────────────────────
export type SheetStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'APPROVED' | 'PUBLISHED';
export interface Assessment {
  id: ID;
  name: string;
  type: 'CA' | 'EXAM' | 'PROJECT' | 'PRACTICAL';
  maxScore: number;
  weight: number;
  date?: ISODate | null;
  subject: Subject;
  marksEntered?: number;
}
export interface SubjectResult {
  subjectId: ID;
  name: string;
  code: string;
  ca: number;
  exam: number;
  total: number;
  grade?: string | null;
  remark?: string | null;
  position?: number | null;
  hasMarks: boolean;
}
export interface ResultSheet {
  id: ID;
  status: SheetStatus;
  average: number;
  overallGrade?: string | null;
  position?: number | null;
  classSize: number;
  subjectCount: number;
  attendancePresent: number;
  attendanceTotal: number;
  promotionStatus?: string | null;
  conduct?: string | null;
  classTeacherComment?: string | null;
  headComment?: string | null;
  rejectionReason?: string | null;
  subjects: SubjectResult[];
  student: Student;
  term: Term;
  workflow: SheetStatus[];
}

// ─────────────────────────── Welfare & operations ───────────────────────────
export interface DisciplineIncident {
  id: ID;
  date: ISODate;
  category: string;
  severity: 'MINOR' | 'MODERATE' | 'SERIOUS';
  description: string;
  actionTaken?: string | null;
  points: number;
  status: 'OPEN' | 'RESOLVED' | 'ESCALATED';
  parentNotified: boolean;
  reportedByName?: string | null;
  createdAt: ISODate;
  resolvedAt?: ISODate | null;
  student: Student;
}
export interface SchoolEvent {
  id: ID;
  title: string;
  description?: string | null;
  type: 'ACADEMIC' | 'HOLIDAY' | 'EXAM' | 'MEETING' | 'SPORTS' | 'CULTURAL' | 'TRIP' | 'OTHER';
  startAt: ISODate;
  endAt: ISODate;
  allDay: boolean;
  location?: string | null;
  audienceType: 'ALL' | 'PARENTS' | 'TEACHERS' | 'STAFF' | 'STUDENTS' | 'CLASS';
  classId?: ID | null;
  className?: string | null;
  isPublic: boolean;
}
export interface Assignment {
  id: ID;
  title: string;
  instructions: string;
  dueAt: ISODate;
  maxScore?: number | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  attachments?: Array<{ name: string; url: string }> | null;
  subject: Subject;
  class: { id: ID; name: string };
  total: number;
  completion: number;
  byStatus: Partial<Record<SubmissionStatus, number>>;
  submissions?: AssignmentSubmission[];
}
export type SubmissionStatus = 'PENDING' | 'SUBMITTED' | 'LATE' | 'GRADED' | 'MISSING';
export interface AssignmentSubmission {
  id: ID;
  studentId: ID;
  status: SubmissionStatus;
  submittedAt?: ISODate | null;
  score?: number | null;
  feedback?: string | null;
  student: Student;
}
export interface LibraryBook {
  id: ID;
  isbn?: string | null;
  title: string;
  author: string;
  category: string;
  publisher?: string | null;
  year?: number | null;
  copiesTotal: number;
  copiesAvailable: number;
  location?: string | null;
}
export interface LibraryLoan {
  id: ID;
  book: LibraryBook;
  student?: Student | null;
  staff?: StaffLite | null;
  borrowedAt: ISODate;
  dueAt: ISODate;
  returnedAt?: ISODate | null;
  status: 'BORROWED' | 'RETURNED' | 'OVERDUE' | 'LOST';
  fine: number;
  finePaid: boolean;
  daysOverdue?: number;
}
export interface TransportRoute {
  id: ID;
  name: string;
  description?: string | null;
  vehicle?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  capacity?: number | null;
  termFee?: number | null;
  isActive: boolean;
  stops: TransportStop[];
  riders: number;
  occupancy?: number | null;
  assignments?: Array<{ id: ID; stopId?: ID | null; stop?: TransportStop | null; student: Student }>;
}
export interface TransportStop {
  id: ID;
  name: string;
  sequence: number;
  pickupTime?: string | null;
  dropoffTime?: string | null;
}
export interface HealthRecord {
  bloodGroup?: string | null;
  allergies?: string | null;
  conditions?: string | null;
  medications?: string | null;
  immunizations?: Array<{ name: string; date?: string }> | null;
  doctorName?: string | null;
  doctorPhone?: string | null;
  insuranceProvider?: string | null;
  insuranceNumber?: string | null;
  notes?: string | null;
  updatedAt?: ISODate;
}
export interface HealthVisit {
  id: ID;
  date: ISODate;
  type: 'SICK_BAY' | 'INJURY' | 'CHECKUP' | 'MEDICATION' | 'EMERGENCY' | 'OTHER';
  complaint: string;
  treatment?: string | null;
  temperature?: number | null;
  referredOut: boolean;
  parentNotified: boolean;
  student?: Student;
}
export interface MessageThread {
  id: ID;
  type: 'DIRECT' | 'GROUP' | 'CLASS';
  subject?: string | null;
  lastMessageAt: ISODate;
  participants: Array<{ id: ID; name: string; userType?: UserType; avatarUrl?: string | null }>;
  lastMessage?: { body: string; senderId: ID; createdAt: ISODate } | null;
  unread: number;
}
export interface Message {
  id: ID;
  body: string;
  createdAt: ISODate;
  senderId: ID;
  sender: { id: ID; name: string };
  mine: boolean;
}
export interface LeaveRequest {
  id: ID;
  staffId: ID;
  type: string;
  startDate: ISODate;
  endDate: ISODate;
  days: number;
  reason?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewNote?: string | null;
  staff: StaffLite;
}
export interface PayrollRun {
  id: ID;
  period: string;
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  staffCount: number;
  approvedAt?: ISODate | null;
  paidAt?: ISODate | null;
  items?: PayrollItem[];
}
export interface PayrollItem {
  id: ID;
  staffId: ID;
  basic: number;
  allowances: number;
  deductions: number;
  net: number;
  notes?: string | null;
  staff: StaffLite & { department?: string | null };
}

// ─────────────────────────── Canteen ───────────────────────────
export interface CanteenItem {
  id: ID;
  name: string;
  category: string;
  price: number;
  stock: number;
  minStock: number;
  unit: string;
  isActive: boolean;
}
export interface Wallet {
  id: ID;
  balance: number;
  dailyLimit?: number | null;
  isActive: boolean;
  transactions: WalletTransaction[];
}
export interface WalletTransaction {
  id: ID;
  type: 'TOPUP' | 'PURCHASE' | 'REFUND' | 'ADJUSTMENT';
  amount: number;
  balanceAfter: number;
  method?: string | null;
  reference?: string | null;
  createdAt: ISODate;
}

// ─────────────────────────── Data export ───────────────────────────
export interface DataExportSummary {
  tables: Array<{ table: string; rows: number }>;
  totalRows: number;
  lastExport: DataExportRecord | null;
  history: DataExportRecord[];
}
export interface DataExportRecord {
  id: ID;
  requestedBy?: string | null;
  format: 'JSON' | 'CSV' | 'SQL' | 'ALL';
  fileName?: string | null;
  tables: number;
  rowCount: number;
  sizeBytes: number;
  durationMs?: number;
  createdAt: ISODate;
}

// ─────────────────────────── Dashboards ───────────────────────────
export interface AdminDashboard {
  school: { name: string; plan: string; subscriptionStatus: string };
  term: { id: ID; name: string; year: string; startDate: ISODate; endDate: ISODate } | null;
  counts: {
    students: number;
    staff: number;
    classes: number;
    parents: number;
    pendingAdmissions: number;
    byGender?: Record<string, number>;
  };
  attendanceToday:
    | ({
        enrolled: number;
        marked: number;
        unmarked: number;
        rate: number;
        classes: Array<
          { classId: ID; name: string; enrolled: number; marked: number } & Record<AttendanceStatus, number>
        >;
      } & Record<AttendanceStatus, number>)
    | null;
  attendanceTrend: Array<{ date: string; rate: number }>;
  fees: (FeeSummary & { today: number }) | null;
  results: Partial<Record<SheetStatus, number>>;
  sync: { devices: number; offlineDevices: number; pendingOperations: number; openConflicts: number };
  canteen: { revenueToday: number; salesToday: number; lowStock: number } | null;
  announcements: Array<{ id: ID; title: string; audienceType: string; publishedAt: ISODate }>;
  recentAudit: Array<{ id: ID; action: string; entity: string; actorName: string; createdAt: ISODate }>;
  upcomingEvents: SchoolEvent[];
  openIncidents: number;
  pendingLeave: number;
  overdueLoans: number;
  unreadMessages: number;
  dueAssignments: number;
  staffOnLeave: number;
}
