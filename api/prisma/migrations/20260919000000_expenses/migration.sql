-- Headmaster records a purchase/expense; the Finance Officer (Accountant role) approves or rejects it.
-- EXPENSE_CREATE and EXPENSE_APPROVE are never granted to the same system role, enforcing genuine
-- separation of duties at the permission level, not just in this table's shape.
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "vendor" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "receiptUrl" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Expense_tenantId_status_idx" ON "Expense"("tenantId", "status");
CREATE INDEX "Expense_tenantId_purchasedAt_idx" ON "Expense"("tenantId", "purchasedAt");

-- Retroactively grant the new expense permissions to every existing tenant's system roles (a code-only
-- change to SYSTEM_ROLES only affects newly registered schools, not roles already written to this
-- table). array(SELECT DISTINCT unnest(...)) both adds the new permission and de-duplicates safely.
UPDATE "Role" SET permissions = array(SELECT DISTINCT unnest(permissions || ARRAY['EXPENSE_VIEW']))
WHERE "isSystem" = true AND name IN ('School Admin', 'Proprietor', 'Headmaster', 'Accountant');

UPDATE "Role" SET permissions = array(SELECT DISTINCT unnest(permissions || ARRAY['EXPENSE_CREATE']))
WHERE "isSystem" = true AND name = 'Headmaster';

UPDATE "Role" SET permissions = array(SELECT DISTINCT unnest(permissions || ARRAY['EXPENSE_APPROVE']))
WHERE "isSystem" = true AND name = 'Accountant';
