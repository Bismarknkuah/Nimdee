# Entity-relationship diagram

Generated from `api/prisma/schema.prisma` (73 models, 43 enums). Every table with a `tenantId` column is protected by PostgreSQL Row-Level Security.

```mermaid
erDiagram
  PlatformUser {
    string id PK
    string email UK
    string passwordHash
    string name
    PlatformRole role
    bool isActive
    datetime lastLoginAt
    datetime createdAt
    datetime updatedAt
  }
  PlatformSetting {
    string key PK
    json value
    datetime updatedAt
  }
  Sequence {
    string scope
    string key
    int value
  }
  Plan {
    string id PK
    string code UK
    string name
    string description
    decimal priceMonthly
    decimal priceYearly
    string currency
    int studentLimit
    string_list features
    int trialDays
    bool isActive
    int sortOrder
    datetime createdAt
    datetime updatedAt
  }
  Tenant {
    string id PK
    string code UK
    string slug UK
    string name
    string type
    string registrationNumber
    string country
    string region
    string district
    string address
    float gpsLat
    float gpsLng
    string phone
    string email
    string website
    string principalName
    string logoUrl
    string faviconUrl
    string primaryColor
    string secondaryColor
    string fontFamily
    string currency
    string timezone
    TenantStatus status
    json settings
    json websiteConfig
    string_list featureOverrides
    datetime approvedAt
    string suspendedReason
    datetime createdAt
    datetime updatedAt
  }
  TenantDomain {
    string id PK
    string tenantId
    string domain UK
    DomainType type
    bool isPrimary
    bool verified
    string verificationToken
    datetime verifiedAt
    datetime createdAt
  }
  Subscription {
    string id PK
    string tenantId UK
    string planId
    SubscriptionStatus status
    BillingCycle billingCycle
    datetime trialEndsAt
    datetime currentPeriodStart
    datetime currentPeriodEnd
    datetime graceUntil
    datetime cancelledAt
    datetime createdAt
    datetime updatedAt
  }
  SubscriptionInvoice {
    string id PK
    string tenantId
    string subscriptionId
    string number UK
    string description
    decimal amount
    string currency
    SubInvoiceStatus status
    datetime dueDate
    datetime paidAt
    string reference
    datetime periodStart
    datetime periodEnd
    datetime createdAt
  }
  AuditLog {
    string id PK
    string tenantId
    string actorId
    string actorType
    string actorName
    string action
    string entity
    string entityId
    json before
    json after
    string reason
    string ip
    string userAgent
    datetime createdAt
  }
  User {
    string id PK
    string tenantId
    string email
    string passwordHash
    string firstName
    string lastName
    string phone
    string avatarUrl
    UserType userType
    bool isActive
    bool mustChangePassword
    datetime lastLoginAt
    datetime createdAt
    datetime updatedAt
  }
  Role {
    string id PK
    string tenantId
    string name
    string description
    bool isSystem
    string_list permissions
    datetime createdAt
    datetime updatedAt
  }
  UserRole {
    string tenantId
    string userId
    string roleId
  }
  RefreshToken {
    string id PK
    string tenantId
    string userId
    string actorType
    string tokenHash UK
    string deviceId
    datetime expiresAt
    datetime revokedAt
    datetime createdAt
  }
  AcademicYear {
    string id PK
    string tenantId
    string name
    datetime startDate
    datetime endDate
    bool isCurrent
    datetime createdAt
  }
  Term {
    string id PK
    string tenantId
    string academicYearId
    string name
    int sequence
    datetime startDate
    datetime endDate
    datetime examStart
    datetime examEnd
    bool isCurrent
    datetime createdAt
  }
  SchoolClass {
    string id PK
    string tenantId
    string name
    string level
    string stream
    int capacity
    string classTeacherId
    string nextClassId
    bool isFinal
    datetime createdAt
    datetime updatedAt
  }
  Subject {
    string id PK
    string tenantId
    string name
    string code
    bool isCore
    datetime createdAt
  }
  ClassSubject {
    string id PK
    string tenantId
    string classId
    string subjectId
    string teacherId
  }
  Room {
    string id PK
    string tenantId
    string name
    int capacity
  }
  Staff {
    string id PK
    string tenantId
    string userId UK
    string employeeId
    string firstName
    string lastName
    string gender
    datetime dateOfBirth
    string phone
    string email
    StaffType staffType
    string department
    string position
    json qualifications
    datetime employmentDate
    StaffStatus status
    decimal basicSalary
    datetime createdAt
    datetime updatedAt
  }
  Student {
    string id PK
    string tenantId
    string studentId
    string userId UK
    string firstName
    string lastName
    string otherNames
    Gender gender
    datetime dateOfBirth
    string classId
    string house
    datetime admissionDate
    StudentStatus status
    bool isBoarding
    string photoUrl
    string previousSchool
    string address
    string medicalNotes
    string emergencyContactName
    string emergencyContactPhone
    int version
    datetime createdAt
    datetime updatedAt
    datetime graduatedAt
  }
  Guardian {
    string id PK
    string tenantId
    string userId UK
    string firstName
    string lastName
    string phone
    string email
    string occupation
    string address
    datetime createdAt
    datetime updatedAt
  }
  StudentGuardian {
    string tenantId
    string studentId
    string guardianId
    string relationship
    bool isPrimary
  }
  Admission {
    string id PK
    string tenantId
    string applicationNumber
    string firstName
    string lastName
    Gender gender
    datetime dateOfBirth
    string appliedLevel
    string appliedClassId
    string guardianName
    string guardianPhone
    string guardianEmail
    string previousSchool
    json documents
    AdmissionStatus status
    string notes
    datetime interviewAt
    string studentId
    datetime createdAt
    datetime updatedAt
  }
  Attendance {
    string id PK
    string tenantId
    string studentId
    string classId
    datetime date
    AttendanceStatus status
    string note
    string markedById
    string source
    string deviceId
    datetime clientTimestamp
    datetime createdAt
    datetime updatedAt
  }
  Device {
    string id PK
    string tenantId
    string userId
    string name
    string platform
    bool isActive
    int pendingCount
    datetime lastSeenAt
    datetime lastSyncAt
    datetime createdAt
  }
  SyncOperation {
    string id PK
    string tenantId
    string deviceId
    string operationId
    string entity
    string action
    json payload
    datetime clientTimestamp
    SyncStatus status
    string error
    json result
    datetime createdAt
  }
  SyncConflict {
    string id PK
    string tenantId
    string entity
    string entityId
    string deviceId
    string operationId
    json serverValue
    json clientValue
    ConflictStatus status
    string resolution
    string resolvedById
    datetime resolvedAt
    datetime createdAt
  }
  FeeCategory {
    string id PK
    string tenantId
    string name
    string description
    bool isActive
  }
  FeeStructure {
    string id PK
    string tenantId
    string academicYearId
    string termId
    string classId
    string level
    string categoryId
    decimal amount
    FeeApplies appliesTo
    datetime createdAt
  }
  StudentDiscount {
    string id PK
    string tenantId
    string studentId
    string name
    DiscountType type
    decimal value
    string categoryId
    string academicYearId
    string reason
    string approvedById
    datetime createdAt
  }
  Invoice {
    string id PK
    string tenantId
    string number
    string studentId
    string academicYearId
    string termId
    decimal subtotal
    decimal discountTotal
    decimal total
    decimal paidTotal
    InvoiceStatus status
    datetime issuedAt
    datetime dueDate
    string notes
    datetime createdAt
    datetime updatedAt
  }
  InvoiceLine {
    string id PK
    string tenantId
    string invoiceId
    string categoryId
    string description
    decimal amount
    decimal discount
  }
  Installment {
    string id PK
    string tenantId
    string invoiceId
    int sequence
    decimal amount
    decimal paidAmount
    datetime dueDate
    InstallmentStatus status
  }
  Payment {
    string id PK
    string tenantId
    string invoiceId
    string studentId
    string purpose
    decimal amount
    PaymentMethod method
    string provider
    string reference
    string providerRef
    PaymentStatus status
    string receiptNumber
    datetime paidAt
    string recordedById
    string guardianId
    string payerEmail
    string notes
    datetime reversedAt
    string reversalReason
    datetime createdAt
  }
  StudentAccount {
    string id PK
    string tenantId
    string studentId UK
    decimal balance
    datetime updatedAt
  }
  LedgerEntry {
    string id PK
    string tenantId
    string studentId
    LedgerType type
    string source
    string refId
    string description
    decimal amount
    decimal balanceAfter
    string createdById
    datetime createdAt
  }
  Assessment {
    string id PK
    string tenantId
    string termId
    string classId
    string subjectId
    string name
    AssessmentType type
    decimal maxScore
    decimal weight
    datetime date
    string createdById
    datetime createdAt
  }
  Mark {
    string id PK
    string tenantId
    string assessmentId
    string studentId
    decimal score
    string enteredById
    datetime updatedAt
  }
  ResultSheet {
    string id PK
    string tenantId
    string termId
    string classId
    string studentId
    json subjects
    decimal totalScore
    decimal average
    int position
    int classSize
    string overallGrade
    int attendancePresent
    int attendanceTotal
    string conduct
    string classTeacherComment
    string headComment
    string promotionStatus
    ResultStatus status
    datetime submittedAt
    datetime reviewedAt
    datetime approvedAt
    datetime publishedAt
    string rejectionReason
    datetime computedAt
    datetime updatedAt
  }
  Period {
    string id PK
    string tenantId
    string name
    string startTime
    string endTime
    int sequence
    bool isBreak
  }
  TimetableSlot {
    string id PK
    string tenantId
    string classId
    string subjectId
    string teacherId
    string roomId
    int dayOfWeek
    string periodId
  }
  CanteenItem {
    string id PK
    string tenantId
    string name
    string category
    decimal price
    int stock
    int minStock
    string unit
    bool isActive
    datetime createdAt
    datetime updatedAt
  }
  Wallet {
    string id PK
    string tenantId
    string studentId UK
    decimal balance
    decimal dailyLimit
    decimal creditLimit
    datetime lastAllowanceAt
    bool isActive
    datetime updatedAt
  }
  WalletTransaction {
    string id PK
    string tenantId
    string walletId
    WalletTxType type
    decimal amount
    decimal balanceAfter
    string reference
    string saleId
    string method
    string byId
    datetime createdAt
  }
  CanteenSale {
    string id PK
    string tenantId
    string studentId
    string cashierId
    json items
    decimal total
    decimal coveredAmount
    int mealCount
    string planId
    SalePaymentMode paymentMode
    datetime createdAt
  }
  CanteenPlan {
    string id PK
    string tenantId
    string code
    string name
    string description
    CanteenPlanType type
    decimal price
    CanteenBillingPeriod billingPeriod
    int mealsPerDay
    decimal dailyLimit
    decimal creditLimit
    decimal allowanceAmount
    CanteenBillingPeriod allowanceFrequency
    bool billToFees
    bool isDefault
    bool isActive
    int sortOrder
    datetime createdAt
    datetime updatedAt
  }
  CanteenPlanItem {
    string id PK
    string tenantId
    string planId
    string itemId
  }
  StudentCanteenPlan {
    string id PK
    string tenantId
    string studentId
    string planId
    string termId
    PlanEnrolmentStatus status
    datetime startDate
    datetime endDate
    string invoiceId
    string notes
    string createdById
    datetime createdAt
    datetime updatedAt
  }
  StockMovement {
    string id PK
    string tenantId
    string itemId
    StockMoveType type
    int quantity
    string reason
    string refId
    string byId
    datetime createdAt
  }
  InventoryItem {
    string id PK
    string tenantId
    string name
    string category
    int quantity
    int minQuantity
    string unit
    string location
    decimal unitCost
    string supplier
    datetime createdAt
    datetime updatedAt
  }
  InventoryMovement {
    string id PK
    string tenantId
    string itemId
    StockMoveType type
    int quantity
    string reason
    string byId
    datetime createdAt
  }
  Announcement {
    string id PK
    string tenantId
    string title
    string body
    AudienceType audienceType
    string classId
    string_list channels
    bool isPublic
    string createdById
    datetime publishedAt
    int recipients
    datetime createdAt
  }
  Notification {
    string id PK
    string tenantId
    string userId
    string title
    string body
    string type
    json data
    datetime readAt
    datetime createdAt
  }
  DataExport {
    string id PK
    string tenantId
    string requestedById
    string requestedBy
    ExportFormat format
    string fileName
    int sizeBytes
    int rowCount
    int tables
    int durationMs
    datetime createdAt
  }
  PasswordResetToken {
    string id PK
    string tenantId
    string userId
    string actorType
    string tokenHash UK
    datetime expiresAt
    datetime usedAt
    datetime createdAt
  }
  DisciplineIncident {
    string id PK
    string tenantId
    string studentId
    datetime date
    string category
    DisciplineSeverity severity
    string description
    string actionTaken
    int points
    DisciplineStatus status
    bool parentNotified
    string reportedById
    string resolvedById
    datetime resolvedAt
    datetime createdAt
    datetime updatedAt
  }
  SchoolEvent {
    string id PK
    string tenantId
    string title
    string description
    EventType type
    datetime startAt
    datetime endAt
    bool allDay
    string location
    AudienceType audienceType
    string classId
    bool isPublic
    string createdById
    datetime createdAt
    datetime updatedAt
  }
  Assignment {
    string id PK
    string tenantId
    string classId
    string subjectId
    string teacherId
    string title
    string instructions
    datetime dueAt
    decimal maxScore
    AssignmentStatus status
    json attachments
    string createdById
    datetime createdAt
    datetime updatedAt
  }
  AssignmentSubmission {
    string id PK
    string tenantId
    string assignmentId
    string studentId
    SubmissionStatus status
    datetime submittedAt
    decimal score
    string feedback
    string gradedById
    datetime gradedAt
    datetime createdAt
    datetime updatedAt
  }
  LibraryBook {
    string id PK
    string tenantId
    string isbn
    string title
    string author
    string category
    string publisher
    int year
    int copiesTotal
    int copiesAvailable
    string location
    datetime createdAt
    datetime updatedAt
  }
  LibraryLoan {
    string id PK
    string tenantId
    string bookId
    string studentId
    string staffId
    datetime borrowedAt
    datetime dueAt
    datetime returnedAt
    LoanStatus status
    decimal fine
    bool finePaid
    string notes
    string issuedById
  }
  TransportRoute {
    string id PK
    string tenantId
    string name
    string description
    string vehicle
    string driverName
    string driverPhone
    int capacity
    decimal termFee
    bool isActive
    datetime createdAt
    datetime updatedAt
  }
  TransportStop {
    string id PK
    string tenantId
    string routeId
    string name
    int sequence
    string pickupTime
    string dropoffTime
  }
  TransportAssignment {
    string id PK
    string tenantId
    string routeId
    string stopId
    string studentId UK
    datetime startDate
    datetime endDate
    bool isActive
    datetime createdAt
  }
  HealthRecord {
    string id PK
    string tenantId
    string studentId UK
    string bloodGroup
    string allergies
    string conditions
    string medications
    json immunizations
    string doctorName
    string doctorPhone
    string insuranceProvider
    string insuranceNumber
    string notes
    datetime updatedAt
  }
  HealthVisit {
    string id PK
    string tenantId
    string studentId
    datetime date
    HealthVisitType type
    string complaint
    string treatment
    decimal temperature
    bool referredOut
    bool parentNotified
    string recordedById
    string notes
    datetime createdAt
  }
  MessageThread {
    string id PK
    string tenantId
    ThreadType type
    string subject
    string classId
    string createdById
    datetime lastMessageAt
    datetime createdAt
  }
  MessageParticipant {
    string id PK
    string tenantId
    string threadId
    string userId
    datetime lastReadAt
  }
  Message {
    string id PK
    string tenantId
    string threadId
    string senderId
    string body
    datetime createdAt
  }
  LeaveRequest {
    string id PK
    string tenantId
    string staffId
    LeaveType type
    datetime startDate
    datetime endDate
    int days
    string reason
    LeaveStatus status
    string reviewedById
    datetime reviewedAt
    string reviewNote
    datetime createdAt
  }
  PayrollRun {
    string id PK
    string tenantId
    string period
    PayrollStatus status
    decimal totalGross
    decimal totalDeductions
    decimal totalNet
    int staffCount
    string notes
    string approvedById
    datetime approvedAt
    datetime paidAt
    string createdById
    datetime createdAt
  }
  PayrollItem {
    string id PK
    string tenantId
    string runId
    string staffId
    decimal basic
    decimal allowances
    decimal deductions
    decimal net
    string notes
  }
  Tenant ||--o{ TenantDomain : "tenant"
  Tenant ||--o{ Subscription : "tenant"
  Plan ||--o{ Subscription : "plan"
  Subscription ||--o{ SubscriptionInvoice : "subscription"
  User ||--o{ UserRole : "user"
  Role ||--o{ UserRole : "role"
  AcademicYear ||--o{ Term : "academicYear"
  Staff ||--o{ SchoolClass : "classTeacher"
  SchoolClass ||--o{ SchoolClass : "nextClass"
  SchoolClass ||--o{ ClassSubject : "class"
  Subject ||--o{ ClassSubject : "subject"
  Staff ||--o{ ClassSubject : "teacher"
  User ||--o{ Staff : "user"
  User ||--o{ Student : "user"
  SchoolClass ||--o{ Student : "class"
  User ||--o{ Guardian : "user"
  Student ||--o{ StudentGuardian : "student"
  Guardian ||--o{ StudentGuardian : "guardian"
  Student ||--o{ Attendance : "student"
  Device ||--o{ SyncOperation : "device"
  FeeCategory ||--o{ FeeStructure : "category"
  Student ||--o{ Invoice : "student"
  Invoice ||--o{ InvoiceLine : "invoice"
  FeeCategory ||--o{ InvoiceLine : "category"
  Invoice ||--o{ Installment : "invoice"
  Invoice ||--o{ Payment : "invoice"
  Student ||--o{ Payment : "student"
  Student ||--o{ StudentAccount : "student"
  Subject ||--o{ Assessment : "subject"
  Assessment ||--o{ Mark : "assessment"
  Student ||--o{ ResultSheet : "student"
  SchoolClass ||--o{ TimetableSlot : "class"
  Subject ||--o{ TimetableSlot : "subject"
  Staff ||--o{ TimetableSlot : "teacher"
  Room ||--o{ TimetableSlot : "room"
  Period ||--o{ TimetableSlot : "period"
  Student ||--o{ Wallet : "student"
  Wallet ||--o{ WalletTransaction : "wallet"
  CanteenPlan ||--o{ CanteenPlanItem : "plan"
  CanteenItem ||--o{ CanteenPlanItem : "item"
  Student ||--o{ StudentCanteenPlan : "student"
  CanteenPlan ||--o{ StudentCanteenPlan : "plan"
  CanteenItem ||--o{ StockMovement : "item"
  InventoryItem ||--o{ InventoryMovement : "item"
  Student ||--o{ DisciplineIncident : "student"
  SchoolClass ||--o{ Assignment : "class"
  Subject ||--o{ Assignment : "subject"
  Assignment ||--o{ AssignmentSubmission : "assignment"
  Student ||--o{ AssignmentSubmission : "student"
  LibraryBook ||--o{ LibraryLoan : "book"
  Student ||--o{ LibraryLoan : "student"
  Staff ||--o{ LibraryLoan : "staff"
  TransportRoute ||--o{ TransportStop : "route"
  TransportRoute ||--o{ TransportAssignment : "route"
  TransportStop ||--o{ TransportAssignment : "stop"
  Student ||--o{ TransportAssignment : "student"
  Student ||--o{ HealthRecord : "student"
  Student ||--o{ HealthVisit : "student"
  MessageThread ||--o{ MessageParticipant : "thread"
  MessageThread ||--o{ Message : "thread"
  Staff ||--o{ LeaveRequest : "staff"
  PayrollRun ||--o{ PayrollItem : "run"
  Staff ||--o{ PayrollItem : "staff"
```

## Enumerations

- **PlatformRole**: SUPER_ADMIN, SUPPORT
- **TenantStatus**: PENDING, ACTIVE, SUSPENDED, REJECTED
- **DomainType**: SUBDOMAIN, CUSTOM
- **SubscriptionStatus**: TRIAL, ACTIVE, PAST_DUE, GRACE, SUSPENDED, CANCELLED
- **BillingCycle**: MONTHLY, YEARLY
- **SubInvoiceStatus**: PENDING, PAID, FAILED, VOID
- **UserType**: STAFF, TEACHER, PARENT, STUDENT
- **StaffType**: TEACHING, NON_TEACHING
- **StaffStatus**: ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED
- **StudentStatus**: ACTIVE, INACTIVE, GRADUATED, TRANSFERRED, SUSPENDED
- **Gender**: MALE, FEMALE, OTHER
- **AdmissionStatus**: SUBMITTED, UNDER_REVIEW, INTERVIEW, ASSESSMENT, APPROVED, REJECTED, ADMITTED
- **AttendanceStatus**: PRESENT, ABSENT, LATE, EXCUSED, SICK
- **SyncStatus**: APPLIED, DUPLICATE, CONFLICT, FAILED
- **ConflictStatus**: OPEN, RESOLVED
- **FeeApplies**: ALL, BOARDING, DAY
- **DiscountType**: PERCENT, FIXED
- **InvoiceStatus**: ISSUED, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED
- **InstallmentStatus**: PENDING, PARTIAL, PAID, OVERDUE
- **PaymentMethod**: CASH, MOBILE_MONEY, CARD, BANK_TRANSFER, CHEQUE, ONLINE
- **PaymentStatus**: PENDING, SUCCESS, FAILED, REVERSED
- **LedgerType**: DEBIT, CREDIT
- **AssessmentType**: CA, EXAM, PROJECT, PRACTICAL
- **ResultStatus**: DRAFT, SUBMITTED, REVIEWED, APPROVED, PUBLISHED
- **WalletTxType**: TOPUP, PURCHASE, REFUND, ADJUSTMENT, ALLOWANCE
- **SalePaymentMode**: WALLET, CASH, MEAL_PLAN, CREDIT
- **CanteenPlanType**: PREPAID, PAY_AS_YOU_GO, MEAL_PLAN, CREDIT, ALLOWANCE
- **CanteenBillingPeriod**: NONE, DAILY, WEEKLY, MONTHLY, TERM
- **PlanEnrolmentStatus**: ACTIVE, SUSPENDED, ENDED
- **StockMoveType**: IN, OUT, ADJUST, WASTE
- **AudienceType**: ALL, PARENTS, TEACHERS, STAFF, STUDENTS, CLASS
- **ExportFormat**: JSON, CSV, SQL
- **DisciplineSeverity**: MINOR, MODERATE, SERIOUS
- **DisciplineStatus**: OPEN, RESOLVED, ESCALATED
- **EventType**: ACADEMIC, HOLIDAY, EXAM, MEETING, SPORTS, CULTURAL, TRIP, OTHER
- **AssignmentStatus**: DRAFT, PUBLISHED, CLOSED
- **SubmissionStatus**: PENDING, SUBMITTED, LATE, GRADED, MISSING
- **LoanStatus**: BORROWED, RETURNED, OVERDUE, LOST
- **HealthVisitType**: SICK_BAY, INJURY, CHECKUP, MEDICATION, EMERGENCY, OTHER
- **ThreadType**: DIRECT, CLASS, GROUP
- **LeaveType**: ANNUAL, SICK, MATERNITY, PATERNITY, STUDY, COMPASSIONATE, UNPAID, OTHER
- **LeaveStatus**: PENDING, APPROVED, REJECTED, CANCELLED
- **PayrollStatus**: DRAFT, APPROVED, PAID

## Tables by area

- **Platform**: PlatformUser, PlatformSetting, Plan, Tenant, TenantDomain, Subscription, SubscriptionInvoice, Sequence, AuditLog, DataExport
- **Identity & access**: User, Role, UserRole, RefreshToken, PasswordResetToken
- **Academics**: AcademicYear, Term, SchoolClass, Subject, ClassSubject, Room, Period, TimetableSlot, Assessment, Mark, ResultSheet, Assignment, AssignmentSubmission
- **People**: Staff, Student, Guardian, StudentGuardian, Admission, DisciplineIncident, HealthRecord, HealthVisit
- **Attendance & sync**: Attendance, Device, SyncOperation, SyncConflict
- **Finance**: FeeCategory, FeeStructure, StudentDiscount, Invoice, InvoiceLine, Installment, Payment, StudentAccount, LedgerEntry, PayrollRun, PayrollItem
- **Canteen & inventory**: CanteenItem, CanteenPlan, CanteenPlanItem, StudentCanteenPlan, Wallet, WalletTransaction, CanteenSale, StockMovement, InventoryItem, InventoryMovement
- **Communication**: Announcement, Notification, MessageThread, MessageParticipant, Message, SchoolEvent
- **Operations**: LibraryBook, LibraryLoan, TransportRoute, TransportStop, TransportAssignment, LeaveRequest
