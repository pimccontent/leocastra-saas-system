# Feature Licensing API

Base URL uses the global prefix from `src/main.ts`, so all routes are under `/api`.

## 1) List Features

`GET /api/features`

Response example:

```json
[
  {
    "key": "rtmp_streams",
    "name": "RTMP Streams",
    "priceCents": 2000,
    "unit": "per_stream",
    "active": true
  },
  {
    "key": "abr_hls",
    "name": "ABR HLS",
    "priceCents": 5000,
    "unit": "flat",
    "active": true
  }
]
```

## 2) Build Quote

`POST /api/licenses/build`

Headers:

- `Authorization: Bearer <token>`
- `Content-Type: application/json`

Request example:

```json
{
  "organizationId": "0e2a6c3f-c40d-46ec-ac44-cf55657bea4b",
  "duration": "monthly",
  "currency": "USD",
  "items": [
    { "featureKey": "rtmp_streams", "quantity": 3 },
    { "featureKey": "srt_streams", "quantity": 1 },
    { "featureKey": "abr_hls", "quantity": 1 }
  ]
}
```

Response example:

```json
{
  "organizationId": "0e2a6c3f-c40d-46ec-ac44-cf55657bea4b",
  "currency": "USD",
  "duration": "monthly",
  "subtotalCents": 14500,
  "totalCents": 14500,
  "durationMultiplier": 1,
  "items": [
    {
      "featureKey": "rtmp_streams",
      "unit": "per_stream",
      "quantity": 3,
      "unitPriceCents": 2000,
      "subtotalCents": 6000
    },
    {
      "featureKey": "srt_streams",
      "unit": "per_stream",
      "quantity": 1,
      "unitPriceCents": 3500,
      "subtotalCents": 3500
    },
    {
      "featureKey": "abr_hls",
      "unit": "flat",
      "quantity": 1,
      "unitPriceCents": 5000,
      "subtotalCents": 5000
    }
  ]
}
```

## 3) Checkout License

`POST /api/licenses/checkout`

Headers:

- `Authorization: Bearer <token>`
- `Content-Type: application/json`

Request example:

```json
{
  "organizationId": "0e2a6c3f-c40d-46ec-ac44-cf55657bea4b",
  "duration": "yearly",
  "items": [
    { "featureKey": "rtmp_streams", "quantity": 3 },
    { "featureKey": "srt_streams", "quantity": 1 },
    { "featureKey": "abr_hls", "quantity": 1 }
  ]
}
```

Response includes license key and resolved feature payload.

## 4) Validate for LeoCastra Instance

`GET /api/license/validate`

Header:

- `x-license-key: <license-key>`

Response example:

```json
{
  "valid": true,
  "features": {
    "rtmp_streams": 3,
    "srt_streams": 1,
    "abr_hls": true
  }
}
```

## 5) End-to-End Smoke Test Checklist

Use this checklist after `npx prisma migrate dev` and `npm run db:seed`.

### A. SaaS: Feature Catalog

- Call `GET /api/features`
- Verify at least `rtmp_streams`, `srt_streams`, and `abr_hls` exist and are `active: true`

### B. SaaS: Build Quote

- Call `POST /api/licenses/build` with:
  - `rtmp_streams: 3`
  - `srt_streams: 1`
  - `abr_hls: 1`
- Verify response totals are computed and breakdown contains 3 entries

### C. SaaS: Checkout License

- Call `POST /api/licenses/checkout` with the same payload
- Save returned `key` (license key)
- Verify returned `features` payload resolves to:
  - `"rtmp_streams": 3`
  - `"srt_streams": 1`
  - `"abr_hls": true`

### D. SaaS: Validate Key

- Call `GET /api/license/validate` with `x-license-key: <key>`
- Verify:
  - `"valid": true`
  - `features` contains numeric stream limits and boolean flags

### E. LeoCastra Instance: Pull + Cache

- Set instance env:
  - `LICENSE_KEY=<key>`
  - `LICENSE_VALIDATE_URL=http://<saas-host>:<saas-port>/api/license/validate`
- Start instance backend and call `GET /api/v1/system/license`
- Verify payload mirrors SaaS validation output

### F. LeoCastra Instance: Helper Readiness

Helpers are implemented but not yet wired into stream create/start:

- `canCreateRtmpStream(currentCount)` should return `true` when `currentCount < rtmp_streams`
- `canCreateSrtStream(currentCount)` should return `true` when `currentCount < srt_streams`
- `canUseFeature('abr_hls')` should return `true` only when entitlement is enabled

### Quick failure-path check

- Change `LICENSE_KEY` to an invalid key and call `GET /api/v1/system/license`
- Verify license falls back to disabled entitlements (or last valid cached payload, if present)
