-- CreateEnum
CREATE TYPE "FeatureUnit" AS ENUM ('per_stream', 'flat');

-- DropForeignKey
ALTER TABLE "License" DROP CONSTRAINT "License_planId_fkey";

-- DropIndex
DROP INDEX "License_planId_idx";

-- AlterTable
ALTER TABLE "License" DROP COLUMN "planId";

-- CreateTable
CREATE TABLE "Feature" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "unit" "FeatureUnit" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "LicenseItem" (
    "id" UUID NOT NULL,
    "licenseId" UUID NOT NULL,
    "featureKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feature_active_idx" ON "Feature"("active");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseItem_licenseId_featureKey_key" ON "LicenseItem"("licenseId", "featureKey");

-- CreateIndex
CREATE INDEX "LicenseItem_featureKey_idx" ON "LicenseItem"("featureKey");

-- AddForeignKey
ALTER TABLE "LicenseItem" ADD CONSTRAINT "LicenseItem_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseItem" ADD CONSTRAINT "LicenseItem_featureKey_fkey" FOREIGN KEY ("featureKey") REFERENCES "Feature"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
