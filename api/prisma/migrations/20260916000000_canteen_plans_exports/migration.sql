-- Canteen payment structures, data exports, password resets, class promotion paths

-- AlterEnum
ALTER TYPE "WalletTxType" ADD VALUE 'ALLOWANCE';
ALTER TYPE "SalePaymentMode" ADD VALUE 'MEAL_PLAN';
ALTER TYPE "SalePaymentMode" ADD VALUE 'CREDIT';

-- CreateEnum
CREATE TYPE "CanteenPlanType" AS ENUM ('PREPAID', 'PAY_AS_YOU_GO', 'MEAL_PLAN', 'CREDIT', 'ALLOWANCE');
CREATE TYPE "CanteenBillingPeriod" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'TERM');
CREATE TYPE "PlanEnrolmentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ENDED');
CREATE TYPE "ExportFormat" AS ENUM ('JSON', 'CSV', 'SQL');

-- AlterTable
ALTER TABLE "SchoolClass" ADD COLUMN "nextClassId" TEXT, ADD COLUMN "isFinal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN "graduatedAt" TIMESTAMP(3);
ALTER TABLE "Wallet" ADD COLUMN "creditLimit" DECIMAL(12,2), ADD COLUMN "lastAllowanceAt" TIMESTAMP(3);
ALTER TABLE "CanteenSale" ADD COLUMN "coveredAmount" DECIMAL(12,2) NOT NULL DEFAULT 0, ADD COLUMN "mealCount" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "planId" TEXT;

-- CreateTable
CREATE TABLE "CanteenPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "CanteenPlanType" NOT NULL,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "billingPeriod" "CanteenBillingPeriod" NOT NULL DEFAULT 'NONE',
    "mealsPerDay" INTEGER NOT NULL DEFAULT 1,
    "dailyLimit" DECIMAL(12,2),
    "creditLimit" DECIMAL(12,2),
    "allowanceAmount" DECIMAL(12,2),
    "allowanceFrequency" "CanteenBillingPeriod" NOT NULL DEFAULT 'NONE',
    "billToFees" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanteenPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CanteenPlanItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,

    CONSTRAINT "CanteenPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentCanteenPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "termId" TEXT,
    "status" "PlanEnrolmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "invoiceId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentCanteenPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataExport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedById" TEXT,
    "requestedBy" TEXT,
    "format" "ExportFormat" NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "tables" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataExport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CanteenPlan_tenantId_code_key" ON "CanteenPlan"("tenantId", "code");
CREATE UNIQUE INDEX "CanteenPlanItem_planId_itemId_key" ON "CanteenPlanItem"("planId", "itemId");
CREATE INDEX "StudentCanteenPlan_tenantId_studentId_status_idx" ON "StudentCanteenPlan"("tenantId", "studentId", "status");
CREATE INDEX "StudentCanteenPlan_tenantId_planId_idx" ON "StudentCanteenPlan"("tenantId", "planId");
CREATE INDEX "CanteenSale_tenantId_studentId_createdAt_idx" ON "CanteenSale"("tenantId", "studentId", "createdAt");
CREATE INDEX "DataExport_tenantId_createdAt_idx" ON "DataExport"("tenantId", "createdAt");
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- AddForeignKey
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_nextClassId_fkey" FOREIGN KEY ("nextClassId") REFERENCES "SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CanteenPlanItem" ADD CONSTRAINT "CanteenPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CanteenPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CanteenPlanItem" ADD CONSTRAINT "CanteenPlanItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CanteenItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentCanteenPlan" ADD CONSTRAINT "StudentCanteenPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentCanteenPlan" ADD CONSTRAINT "StudentCanteenPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CanteenPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security for the new tenant tables
ALTER TABLE "CanteenPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CanteenPlan" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "CanteenPlan" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "CanteenPlanItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CanteenPlanItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "CanteenPlanItem" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "StudentCanteenPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentCanteenPlan" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "StudentCanteenPlan" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "DataExport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataExport" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "DataExport" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PasswordResetToken" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "CanteenPlan", "CanteenPlanItem", "StudentCanteenPlan", "DataExport", "PasswordResetToken" TO schoolos_app;
