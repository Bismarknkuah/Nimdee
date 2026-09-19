-- A fuller self-service profile: a short bio, an address, and a date of birth, alongside the name/
-- phone/avatar already editable. All optional, so nothing is required retroactively.
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
ALTER TABLE "User" ADD COLUMN "address" TEXT;
ALTER TABLE "User" ADD COLUMN "dateOfBirth" DATE;
