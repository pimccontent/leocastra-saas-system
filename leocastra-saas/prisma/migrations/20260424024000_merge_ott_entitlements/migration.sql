-- Merge legacy OTT-related feature flags into ott_stream.
-- This migration is idempotent and safe to run once via prisma migrate deploy.

-- 1) Ensure canonical OTT feature exists in catalog.
INSERT INTO "Feature" ("key", "name", "priceCents", "unit", "active", "createdAt", "updatedAt")
VALUES ('ott_stream', 'OTT Stream Module', 6000, 'flat', true, NOW(), NOW())
ON CONFLICT ("key")
DO UPDATE SET
  "name" = EXCLUDED."name",
  "unit" = EXCLUDED."unit",
  "active" = true,
  "updatedAt" = NOW();

-- 2) Deactivate removed catalog keys so pricing/module UIs do not expose them.
UPDATE "Feature"
SET
  "active" = false,
  "updatedAt" = NOW()
WHERE "key" IN ('abr', 'abr_hls', 'signed_hls', 'webrtc', 'sign_hls');

-- 3) Normalize existing plan feature JSON.
-- If any legacy key is present and ott_stream is missing/false, set ott_stream=true.
UPDATE "Plan"
SET
  "features" = jsonb_set(
    COALESCE("features", '{}'::jsonb),
    '{ott_stream}',
    'true'::jsonb,
    true
  ),
  "updatedAt" = NOW()
WHERE (
  COALESCE("features", '{}'::jsonb) ? 'abr'
  OR COALESCE("features", '{}'::jsonb) ? 'abr_hls'
  OR COALESCE("features", '{}'::jsonb) ? 'signed_hls'
  OR COALESCE("features", '{}'::jsonb) ? 'webrtc'
  OR COALESCE("features", '{}'::jsonb) ? 'sign_hls'
)
AND COALESCE(("features"->>'ott_stream')::boolean, false) = false;

-- Remove legacy keys from plan JSON after migration.
UPDATE "Plan"
SET
  "features" = COALESCE("features", '{}'::jsonb)
    - 'abr'
    - 'abr_hls'
    - 'signed_hls'
    - 'webrtc'
    - 'sign_hls',
  "updatedAt" = NOW()
WHERE
  COALESCE("features", '{}'::jsonb) ? 'abr'
  OR COALESCE("features", '{}'::jsonb) ? 'abr_hls'
  OR COALESCE("features", '{}'::jsonb) ? 'signed_hls'
  OR COALESCE("features", '{}'::jsonb) ? 'webrtc'
  OR COALESCE("features", '{}'::jsonb) ? 'sign_hls';

-- 4) Normalize existing issued license items:
-- create ott_stream item when a license had any legacy OTT item and no ott_stream yet.
INSERT INTO "LicenseItem" ("id", "licenseId", "featureKey", "quantity", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  legacy."licenseId",
  'ott_stream',
  1,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT li."licenseId"
  FROM "LicenseItem" li
  WHERE li."featureKey" IN ('abr', 'abr_hls', 'signed_hls', 'webrtc', 'sign_hls')
) AS legacy
LEFT JOIN "LicenseItem" existing
  ON existing."licenseId" = legacy."licenseId"
  AND existing."featureKey" = 'ott_stream'
WHERE existing."id" IS NULL;

-- Remove legacy license items after canonical ott_stream is present.
DELETE FROM "LicenseItem"
WHERE "featureKey" IN ('abr', 'abr_hls', 'signed_hls', 'webrtc', 'sign_hls');
