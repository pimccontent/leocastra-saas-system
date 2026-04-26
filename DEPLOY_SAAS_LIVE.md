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

## 4) Configure reverse proxy + HTTPS (recommended)

Expose:
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
