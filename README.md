# Online Store

Production-oriented commerce monorepo for a small/medium single-brand store.

| App | Stack | Deploy |
|---|---|---|
| `apps/storefront` | Astro, TypeScript, BEM CSS, i18n (`en`/`de`), SEO, analytics | CDN (Cloudflare Pages) |
| `apps/api` | NestJS, Prisma, PostgreSQL, Redis, Stripe, BullMQ | Docker |
| `apps/admin` | React 19, TanStack Query, Vite | Docker (nginx) |

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm docker:up
# Postgres :5434 · Redis :6381 (see .env.example)
pnpm --filter @online-store/shared-types build
pnpm --filter @online-store/api-client build
pnpm --filter @online-store/api exec prisma migrate dev --name init
pnpm db:seed
pnpm --filter @online-store/api dev
pnpm --filter @online-store/admin dev
pnpm --filter @online-store/storefront dev
```

- Storefront: http://localhost:4321
- Admin: http://localhost:5173 (`admin@example.com` / `ChangeMe123!`)
- API docs: http://localhost:3001/docs
- Optional full stack: `docker compose -f docker/docker-compose.yml --profile full up -d`

## Scripts

- `pnpm build` / `pnpm lint` / `pnpm typecheck` / `pnpm test`
- `pnpm docker:up` / `pnpm docker:down`
- `scripts/backup-db.sh` — Postgres dump

## Docs

- [Architecture](docs/architecture.md)
- [ADRs](docs/adr/)
- [Backup/restore](docs/runbooks/backup-restore.md)
- [Production deploy](docs/runbooks/production-deploy.md)

## Modules

Catalog (variants + metafields), inventory, cart, Stripe checkout, orders, discounts, shipping, tax rates, media, CMS pages/menus, analytics events, notifications, admin RBAC (`owner`/`staff`), reviews, customer accounts, multi-currency rates.
