INSERT INTO "Plan"
  ("id", "code", "name", "priceCents", "currency", "maxStreams", "billingCycle", "features", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'basic', 'Basic', 2900, 'USD', 2, 'monthly', '{"ott_stream": true, "restreaming": true, "cameraBridge": false}'::jsonb, true, NOW(), NOW()),
  (gen_random_uuid(), 'pro', 'Pro', 9900, 'USD', 10, 'monthly', '{"ott_stream": true, "restreaming": true, "cameraBridge": true}'::jsonb, true, NOW(), NOW()),
  (gen_random_uuid(), 'enterprise', 'Enterprise', 29900, 'USD', 50, 'monthly', '{"ott_stream": true, "restreaming": true, "cameraBridge": true}'::jsonb, true, NOW(), NOW())
ON CONFLICT ("code")
DO UPDATE SET
  "name" = EXCLUDED."name",
  "priceCents" = EXCLUDED."priceCents",
  "currency" = EXCLUDED."currency",
  "maxStreams" = EXCLUDED."maxStreams",
  "billingCycle" = EXCLUDED."billingCycle",
  "features" = EXCLUDED."features",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = NOW();

INSERT INTO "Feature"
  ("key", "name", "priceCents", "unit", "active", "createdAt", "updatedAt")
VALUES
  ('rtmp_streams', 'RTMP Streams', 2000, 'per_stream', true, NOW(), NOW()),
  ('srt_streams', 'SRT Streams', 3500, 'per_stream', true, NOW(), NOW()),
  ('ott_stream', 'OTT Stream Module', 6000, 'flat', true, NOW(), NOW()),
  ('restreaming', 'Restreaming', 3000, 'flat', true, NOW(), NOW()),
  ('recording', 'Recording', 2000, 'flat', true, NOW(), NOW()),
  ('liveStudio', 'Live Studio', 3500, 'flat', true, NOW(), NOW()),
  ('virtualLive', 'Virtual Live', 2800, 'flat', true, NOW(), NOW()),
  ('cameraBridge', 'Camera Bridge', 2200, 'flat', true, NOW(), NOW())
ON CONFLICT ("key")
DO UPDATE SET
  "name" = EXCLUDED."name",
  "priceCents" = EXCLUDED."priceCents",
  "unit" = EXCLUDED."unit",
  "active" = EXCLUDED."active",
  "updatedAt" = NOW();

UPDATE "Feature"
SET
  "active" = false,
  "updatedAt" = NOW()
WHERE "key" IN ('abr', 'abr_hls', 'signed_hls', 'webrtc', 'sign_hls');
