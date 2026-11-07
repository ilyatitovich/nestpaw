# Online Store

Commerce monorepo for a small/medium single-brand store (Astro storefront, NestJS API, React admin).

| App | Stack | Deploy |
|---|---|---|
| `apps/storefront` | Astro, TypeScript, BEM CSS, i18n (`en`/`de`), SEO | CDN (Cloudflare Pages) |
| `apps/api` | NestJS, Prisma, PostgreSQL, Redis, Stripe, BullMQ | Docker |
| `apps/admin` | React 19, TanStack Query, Vite | Docker (nginx) |

## Status

**Demo-complete locally** (catalog → cart → checkout → mock/Stripe pay → admin fulfill). Not a turnkey production deploy until you finish the checklist below.

### Production blockers addressed in codebase

- Stripe line items match order totals (including discounts)
- Mock payments gated (`ALLOW_MOCK_PAYMENTS`, forced off when `NODE_ENV=production`)
- Guest checkout collects a real shipping address
- Inventory decrements atomically on pay; restock on cancel/refund of paid orders
- Production boot refuses default/weak `JWT_ACCESS_SECRET`
- Wishlist requires a customer JWT (no body `customerId`)

### Still thin / verify before real traffic

- Admin CRUD depth (shipping/CMS/settings mostly list or JSON)
- Customer account UX beyond login + `/customers/me`
- Observability (Sentry init only; no deep tracing)
- Playwright critical path is opt-in in CI (`E2E_API=1`)

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
- `pnpm test:e2e` — Playwright (set `E2E_API=1` with API up for money-path test)
- `pnpm docker:up` / `pnpm docker:down`
- `BACKUP_ENV=prod COMPOSE_FILE=docker/docker-compose.prod.yml scripts/backup-db.sh`

## Docs

- [Architecture](docs/architecture.md)
- [ADRs](docs/adr/)
- [Backup/restore](docs/runbooks/backup-restore.md)
- [Production deploy](docs/runbooks/production-deploy.md)

## Modules

Catalog (variants + metafields), inventory, cart, Stripe checkout, orders, discounts, shipping, tax rates, media, CMS pages/menus, analytics events, notifications, admin RBAC (`owner`/`staff`), reviews, customer accounts (JWT), multi-currency rates (stored; checkout still EUR-primary).
