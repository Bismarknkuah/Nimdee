-- New pricing: Starter GHS 1500/yr (unchanged), Professional GHS 4000/yr (was 4500), Enterprise
-- GHS 7000/yr (was 12000), each with monthly at roughly 1/10th (a "pay yearly, get ~2 months free"
-- discount, matching the existing pattern). All three now carry a 90-day free trial as a launch
-- promotion. A code-only change to DEFAULT_PLANS only affects a brand-new, never-bootstrapped
-- platform database, not one that already ran its one-time plan seed — hence this data migration.
-- The platform admin can still raise or lower any of this at any time from Platform > Plans.
UPDATE "Plan" SET "priceMonthly" = 150, "priceYearly" = 1500, "trialDays" = 90 WHERE code = 'STARTER';
UPDATE "Plan" SET "priceMonthly" = 400, "priceYearly" = 4000, "trialDays" = 90 WHERE code = 'PROFESSIONAL';
UPDATE "Plan" SET "priceMonthly" = 700, "priceYearly" = 7000, "trialDays" = 90 WHERE code = 'ENTERPRISE';
