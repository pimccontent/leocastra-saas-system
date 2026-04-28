-- CreateTable
CREATE TABLE "LicenseKeyPool" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "note" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "LicenseKeyPool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LicenseKeyPool_key_key" ON "LicenseKeyPool"("key");

-- CreateIndex
CREATE INDEX "LicenseKeyPool_createdAt_idx" ON "LicenseKeyPool"("createdAt");

