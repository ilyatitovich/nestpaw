# Nestpaw — Online Pet Store

Commerce monorepo for **Nestpaw**, a DACH specialty shop for dogs, cats, and small pets (Astro storefront, NestJS API, React admin).

| App               | Stack                                             | Deploy                 |
| ----------------- | ------------------------------------------------- | ---------------------- |
| `apps/storefront` | Astro, TypeScript, BEM CSS, i18n (`en`/`de`), SEO | CDN (Cloudflare Pages) |
| `apps/api`        | NestJS, Prisma, PostgreSQL, Redis, Stripe, BullMQ | Docker                 |
| `apps/admin`      | React 19, TanStack Query, Vite                    | Docker (nginx)         |

## Demo credentials

- **Admin:** http://localhost:5173 — `admin@example.com` / `ChangeMe123!`
- **Storefront:** http://localhost:4321/en/
- **API docs:** http://localhost:3001/docs
- **Discount:** `WELCOME10` (10%)
- **Free shipping UX:** progress messaging from €49 (shipping rates still charged unless a free-shipping discount applies)

Seed loads ~26 pet products across Dogs / Cats / Small pets with nested categories, Unsplash demo images, CMS pages (about, shipping, returns, privacy, terms, contact), and sample reviews.

### Image attribution

Product and hero photos are hotlinked from [Unsplash](https://unsplash.com/license) for demonstration. Replace with owned or properly licensed assets before production.

## Status

**Demo-complete locally** (catalog → cart → checkout → mock/Stripe pay → admin fulfill). Not a turnkey production deploy until you finish the checklist below.

### Production blockers addressed in codebase

- Stripe line items match order totals (including discounts)
- Mock payments gated (`ALLOW_MOCK_PAYMENTS`, forced off when `NODE_ENV=production`)
- Guest checkout collects a real shipping address
- Inventory decrements atomically on pay; restock on cancel/refund of paid orders
- Production boot refuses default/weak `JWT_ACCESS_SECRET`
- Wishlist requires a customer JWT (no body `customerId`)
- Customer accounts use email OTP or Google/Apple OAuth (see `docs/runbooks/customer-auth.md`)
- Admin Categories CRUD with nesting + product assignment

### Still thin / verify before real traffic

- Shipping/CMS/settings admin editors remain list-oriented
- Observability (Sentry init only; no deep tracing)
- Playwright critical path is opt-in (`E2E_API=1`, `E2E_STOREFRONT=1`)

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm docker:up
# Postgres :5434 · Redis :6381 (see .env.example)
pnpm --filter @online-store/shared-types build
pnpm --filter @online-store/api-client build
pnpm --filter @online-store/api exec prisma migrate deploy
pnpm db:seed
pnpm --filter @online-store/api dev
pnpm --filter @online-store/admin dev
pnpm --filter @online-store/storefront dev
```

Re-seed (wipes catalog/CMS demo data, keeps admin user):

```bash
pnpm db:seed
```

`pnpm docker:up` starts Postgres, Redis, and Mailpit (SMTP `localhost:1025`, inbox [http://localhost:8025](http://localhost:8025)). Optional MinIO: `docker compose -f docker/docker-compose.yml --profile full up -d`

## Scripts

- `pnpm build` / `pnpm lint` / `pnpm typecheck` / `pnpm test`
- `pnpm test:e2e` — Playwright (`E2E_API=1` money path + category publish; `E2E_STOREFRONT=1` Nestpaw browse)
- `pnpm docker:up` / `pnpm docker:down`
- `BACKUP_ENV=prod COMPOSE_FILE=docker/docker-compose.prod.yml scripts/backup-db.sh`

## Docs

- [Architecture](docs/architecture.md)
- [ADRs](docs/adr/)
- [Backup/restore](docs/runbooks/backup-restore.md)
- [Production deploy](docs/runbooks/production-deploy.md)

## Modules

Catalog (variants + metafields + nested collections), inventory, cart, Stripe checkout, orders, discounts, shipping, tax rates, media, CMS pages/menus, analytics events, notifications, admin RBAC (`owner`/`staff`), reviews, customer accounts (email OTP + Google/Apple OAuth), multi-currency rates (stored; checkout still EUR-primary).
