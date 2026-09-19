-- A school "house" with a designated House Master/Mistress, one of the additional responsibilities
-- (alongside Form Master) a Headmaster assigns to a teacher beyond their normal subject load.
CREATE TABLE "House" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "houseMasterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "House_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "House_tenantId_name_key" ON "House"("tenantId", "name");

ALTER TABLE "House" ADD CONSTRAINT "House_houseMasterId_fkey" FOREIGN KEY ("houseMasterId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
