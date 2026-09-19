-- A recorded feeding payment for a specific stretch of school days, at the plan's daily rate.
-- The Canteen Manager picks a period (day/week/month/term) and the amount is computed from actual
-- school days in that period rather than a flat one-time price, matching how families actually pay
-- for feeding: daily, weekly, monthly or per term.
CREATE TYPE "FeedingPeriodType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'TERMLY');

CREATE TABLE "CanteenFeedingCharge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "periodType" "FeedingPeriodType" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "schoolDays" INTEGER NOT NULL,
    "dailyRate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "billedToFees" BOOLEAN NOT NULL DEFAULT true,
    "invoiceId" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanteenFeedingCharge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CanteenFeedingCharge_tenantId_studentId_periodStart_idx" ON "CanteenFeedingCharge"("tenantId", "studentId", "periodStart");
CREATE INDEX "CanteenFeedingCharge_tenantId_planId_idx" ON "CanteenFeedingCharge"("tenantId", "planId");

ALTER TABLE "CanteenFeedingCharge" ADD CONSTRAINT "CanteenFeedingCharge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CanteenFeedingCharge" ADD CONSTRAINT "CanteenFeedingCharge_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CanteenPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
