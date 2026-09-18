-- Lets a platform team member set a profile photo too, matching school-side users, so "every user
-- type can update their profile and upload a DP" is actually true for the platform side as well.
ALTER TABLE "PlatformUser" ADD COLUMN "avatarUrl" TEXT;
