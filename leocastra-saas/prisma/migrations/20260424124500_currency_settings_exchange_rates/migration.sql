-- AlterTable
ALTER TABLE "PlatformSettings"
ADD COLUMN "billingBaseCurrency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN "exchangeRates" JSONB;

UPDATE "PlatformSettings"
SET "exchangeRates" = '{"USD":1,"GHS":15}'::jsonb
WHERE "exchangeRates" IS NULL;
