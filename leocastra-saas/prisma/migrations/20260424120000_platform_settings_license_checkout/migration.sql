-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "paystackPublicKey" TEXT,
    "paystackSecretKey" TEXT,
    "paystackWebhookSecret" TEXT,
    "binancePayApiKey" TEXT,
    "binancePaySecretKey" TEXT,
    "binancePayMerchantId" TEXT,
    "binancePayWebhookSecret" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformSettings" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- AlterTable
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_planId_fkey";

ALTER TABLE "Transaction" ALTER COLUMN "planId" DROP NOT NULL;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
