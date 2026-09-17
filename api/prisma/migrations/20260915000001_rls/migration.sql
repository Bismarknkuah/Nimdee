-- Row-Level Security: hard tenant isolation at the database layer.
-- The application sets app.tenant_id (and app.bypass_rls=off) inside every transaction for school requests,
-- and app.bypass_rls=on only for platform-owner operations. A connection with neither setting sees no tenant rows.

ALTER TABLE "TenantDomain" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantDomain" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "TenantDomain" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Subscription" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "SubscriptionInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionInvoice" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "SubscriptionInvoice" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "AuditLog" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "User" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Role" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "UserRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserRole" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "UserRole" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefreshToken" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "RefreshToken" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "AcademicYear" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AcademicYear" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "AcademicYear" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Term" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Term" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Term" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "SchoolClass" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchoolClass" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "SchoolClass" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Subject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subject" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Subject" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "ClassSubject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClassSubject" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ClassSubject" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Room" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Room" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Room" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Staff" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Staff" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Student" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Student" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Student" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Guardian" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Guardian" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Guardian" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "StudentGuardian" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentGuardian" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "StudentGuardian" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Admission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Admission" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Admission" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attendance" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Attendance" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Device" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Device" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Device" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "SyncOperation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncOperation" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "SyncOperation" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "SyncConflict" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncConflict" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "SyncConflict" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "FeeCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeeCategory" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "FeeCategory" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "FeeStructure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeeStructure" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "FeeStructure" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "StudentDiscount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentDiscount" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "StudentDiscount" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Invoice" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "InvoiceLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvoiceLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "InvoiceLine" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Installment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Installment" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Installment" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Payment" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "StudentAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentAccount" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "StudentAccount" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "LedgerEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LedgerEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "LedgerEntry" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Assessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Assessment" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Assessment" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Mark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Mark" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Mark" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "ResultSheet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResultSheet" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ResultSheet" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Period" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Period" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Period" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "TimetableSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimetableSlot" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "TimetableSlot" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "CanteenItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CanteenItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "CanteenItem" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Wallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Wallet" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Wallet" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "WalletTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WalletTransaction" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "WalletTransaction" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "CanteenSale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CanteenSale" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "CanteenSale" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "CanteenPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CanteenPlan" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "CanteenPlan" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "CanteenPlanItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CanteenPlanItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "CanteenPlanItem" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "StudentCanteenPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentCanteenPlan" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "StudentCanteenPlan" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockMovement" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "StockMovement" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "InventoryItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "InventoryItem" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "InventoryMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryMovement" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "InventoryMovement" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Announcement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Announcement" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Announcement" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Notification" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "DataExport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataExport" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "DataExport" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PasswordResetToken" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "DisciplineIncident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DisciplineIncident" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "DisciplineIncident" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "SchoolEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchoolEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "SchoolEvent" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Assignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Assignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Assignment" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "AssignmentSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssignmentSubmission" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "AssignmentSubmission" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "LibraryBook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LibraryBook" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "LibraryBook" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "LibraryLoan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LibraryLoan" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "LibraryLoan" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "TransportRoute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransportRoute" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "TransportRoute" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "TransportStop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransportStop" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "TransportStop" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "TransportAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransportAssignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "TransportAssignment" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "HealthRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HealthRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "HealthRecord" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "HealthVisit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HealthVisit" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "HealthVisit" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "MessageThread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageThread" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "MessageThread" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "MessageParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageParticipant" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "MessageParticipant" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Message" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "LeaveRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "LeaveRequest" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "PayrollRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollRun" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PayrollRun" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "PayrollItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PayrollItem" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Tenant" USING (current_setting('app.bypass_rls', true) = 'on' OR "id" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "id" = current_setting('app.tenant_id', true));

-- Application role. Superusers bypass RLS, so the API switches to this non-superuser role on every
-- pooled connection (SET ROLE schoolos_app) which makes the policies above binding.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'schoolos_app') THEN CREATE ROLE schoolos_app NOLOGIN NOBYPASSRLS; END IF;
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'Could not create role schoolos_app; RLS will rely on application scoping only';
END $$;
GRANT USAGE ON SCHEMA public TO schoolos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO schoolos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO schoolos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO schoolos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO schoolos_app;
GRANT schoolos_app TO CURRENT_USER;
