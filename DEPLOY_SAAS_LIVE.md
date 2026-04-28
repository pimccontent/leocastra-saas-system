# Deploy SaaS Backend + Web (Live)

This deploys:
- `leocastra-saas` backend (NestJS + Prisma)
- `leocastra-saas-web` frontend (Next.js)
- PostgreSQL for SaaS data

It is suitable for hosting your license verification API on a live server.

## 1) Prepare environment

From the repo root:

1. Copy env template:
   - `cp .env.saas-live.example .env.saas-live` (Linux/macOS)
   - or duplicate manually on Windows.
2. Edit `.env.saas-live` and set:
   - `SAAS_DB_PASSWORD` (strong)
   - `AUTH_JWT_SECRET` (strong, 32+ chars)
   - `SUPERADMIN_EMAIL`
   - `SUPERADMIN_PASSWORD`
   - `SAAS_PUBLIC_API_URL` to your public API URL (for example `https://saas-api.example.com/api`)

## 2) Build and start

From repo root:

```bash
docker compose --env-file .env.saas-live -f docker-compose.saas-live.yml up -d --build
```

## One-command install (Ubuntu)

This installs Docker (if needed), clones the repo to `/opt/leocastra-saas-system`, generates secrets, starts the stack, and configures **Caddy reverse proxy + automatic HTTPS**.

Replace `saas-api.example.com` with your public API hostname (must match your TLS cert later):

```bash
curl -fsSL https://raw.githubusercontent.com/pimccontent/leocastra-saas-system/main/deploy/ubuntu-one-command.sh | sudo bash -s -- --api-domain saas-api.example.com
```

Optional web hostname:

```bash
curl -fsSL https://raw.githubusercontent.com/pimccontent/leocastra-saas-system/main/deploy/ubuntu-one-command.sh | sudo bash -s -- --api-domain saas-api.example.com --web-domain saas.example.com
```

Single-domain mode (recommended if you want one hostname):

```bash
curl -fsSL https://raw.githubusercontent.com/pimccontent/leocastra-saas-system/main/deploy/ubuntu-one-command.sh | sudo bash -s -- --api-domain ignored.example.com --single-domain saas.example.com
```

## 3) Verify services

Check backend:

```bash
curl http://127.0.0.1:3001/api/site/settings
```

Check frontend:

```bash
curl http://127.0.0.1:3000
```

Login bootstrap account:
- Email: `SUPERADMIN_EMAIL`
- Password: `SUPERADMIN_PASSWORD`

Note:
- The superadmin user is created automatically on first boot when `SUPERADMIN_EMAIL` + `SUPERADMIN_PASSWORD` are set.
- If you change `SUPERADMIN_PASSWORD` later, the existing user password will not be overwritten automatically. Reset by deleting the DB volume or updating the password in the database.

## 4) Configure reverse proxy + HTTPS (recommended)

The one-command install configures Caddy for you.

Multi-domain:
- `https://saas.example.com` -> `http://127.0.0.1:3000`
- `https://saas-api.example.com` -> `http://127.0.0.1:3001`

If you use a single domain, proxy `/api` to backend and `/` to web, then set:
- `SAAS_PUBLIC_API_URL=https://your-domain.com/api`

## 5) Update license verification target on live LeoCastra backend

On your live main backend (`leocastra/backend`), set:

```env
LICENSE_VALIDATE_URL=https://saas-api.example.com/api/license/validate
```

Then restart the main backend service.

## 6) Operational commands

Logs:

```bash
docker compose --env-file .env.saas-live -f docker-compose.saas-live.yml logs -f
```

Restart:

```bash
docker compose --env-file .env.saas-live -f docker-compose.saas-live.yml restart
```

Stop:

```bash
docker compose --env-file .env.saas-live -f docker-compose.saas-live.yml down
```

## Paystack webhook (required to record payments)

The system marks transactions as `SUCCEEDED` only after it receives the Paystack webhook.

- **Webhook URL**: `https://<your-domain>/api/payments/webhook/paystack`
  - Single-domain example: `https://licapi.unibms.com/api/payments/webhook/paystack`
- **Webhook signature header**: Paystack sends `x-paystack-signature` (handled automatically).

Set these env vars:
- `PAYSTACK_SECRET_KEY=sk_live_...`
- `PAYSTACK_WEBHOOK_SECRET=...` (your Paystack webhook signing secret; commonly your secret key)
- `PAYSTACK_CALLBACK_URL=https://<your-domain>/payment/callback` (browser redirect after payment)
