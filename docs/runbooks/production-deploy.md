# Production deploy checklist

## 1. Environment

Copy `.env.example` → `.env` and set production values. Critical:

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_ACCESS_SECRET` | strong secret, **≥ 32 chars** (boot fails otherwise) |
| `ALLOW_MOCK_PAYMENTS` | `false` (also forced in Compose) |
| `COOKIE_SECURE` | `true` |
| `DATABASE_URL` | `postgresql://USER:PASS@postgres:5432/DB?schema=public` (Compose DNS, not `localhost`) |
| `REDIS_URL` | `redis://redis:6379` |
| `API_PORT` | Container listens on **3000** (Compose overrides this) |
| `CORS_ORIGINS` | storefront + admin origins |
| `PUBLIC_API_URL` | public HTTPS API URL (admin build arg) |
| Stripe / S3 / SMTP / `SENTRY_DSN` | live credentials |

Do **not** reuse local `localhost:5434` / `localhost:6381` URLs inside Compose.

## 2. DNS & TLS

- Storefront → Cloudflare Pages
- `api.` and `admin.` → VPS (terminate TLS at reverse proxy; proxy to `:3000` and `:8080`)

## 3. Bring up stack

```bash
docker compose -f docker/docker-compose.prod.yml up -d --build
docker compose -f docker/docker-compose.prod.yml exec api npx prisma migrate deploy
# once: seed owner
docker compose -f docker/docker-compose.prod.yml exec api npx prisma db seed
```

## 4. Stripe

Webhook → `https://api.example.com/payments/webhook` (`checkout.session.completed`).

## 5. Smoke

1. Admin login → publish product
2. Storefront add to cart → enter shipping → checkout
3. Confirm webhook marks order `paid` and inventory decrements
4. Fulfill / refund in admin; confirm restock on refund

## 6. Ops

- Install backup cron (`BACKUP_ENV=prod` — see [backup-restore](backup-restore.md))
- Confirm `/health/ready`
- Lighthouse pass on homepage
