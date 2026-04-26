-- AlterTable
ALTER TABLE "PlatformSettings"
ADD COLUMN "siteTitle" TEXT,
ADD COLUMN "siteDescription" TEXT,
ADD COLUMN "siteLogoUrl" TEXT,
ADD COLUMN "siteFaviconUrl" TEXT,
ADD COLUMN "seoMetaTitle" TEXT,
ADD COLUMN "seoMetaDescription" TEXT,
ADD COLUMN "seoKeywords" JSONB;
