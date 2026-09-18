-- Lets a school's own admins hide plan-included features from their staff/parent views,
-- separate from featureOverrides (which only ever adds bonus features, platform-admin only).
ALTER TABLE "Tenant" ADD COLUMN "disabledFeatures" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
