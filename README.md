# Nestpaw — Online Pet Store

Commerce monorepo for **Nestpaw**, a DACH specialty shop for dogs, cats, and small pets (Astro storefront, NestJS API, React admin).

| App               | Stack                                             | Deploy                 |
| ----------------- | ------------------------------------------------- | ---------------------- |
| `apps/storefront` | Astro, TypeScript, BEM CSS, i18n (`en`/`de`), SEO | CDN (Cloudflare Pages) |
| `apps/api`        | NestJS, Prisma, PostgreSQL, Redis, Stripe, BullMQ | Docker                 |
| `apps/admin`      | React 19, TanStack Query, Vite                    | Docker (nginx)         |

## Demo credentials

- **Admin:** http://localhost:5173 — `admin@example.com` / `ChangeMe123!`
- **Storefront:** http://localhost:4321/
- **API docs:** http://localhost:3001/docs
- **Discount:** `WELCOME10` (10%)
- **Free shipping:** €49 threshold enforced server-side

Seed loads ~26 pet products across Dogs / Cats / Small pets with nested categories, Unsplash demo images, CMS pages (about, shipping, returns, privacy, terms, contact, **Impressum**, **Widerruf**), and sample reviews.

### Image attribution

Product and hero photos are hotlinked from [Unsplash](https://unsplash.com/license) for demonstration. Replace with owned or properly licensed assets before production.

## Status

**Demo-complete locally** (catalog → cart → checkout → mock/Stripe pay → admin fulfill). Production deploy still needs real secrets, TLS reverse proxy, and Stripe Dashboard payment methods (Klarna/PayPal/SEPA; enable Link/Apple Pay/Google Pay for express checkout and register the storefront domain as a Stripe payment-method domain).

### Production engineering in codebase

- Gross (VAT-inclusive) prices + product tax classes (DE/AT reduced food rates)
- Stripe line items match order totals; currency forced to EUR; checkout URL allowlist
- Mock payments gated (`ALLOW_MOCK_PAYMENTS`, forced off when `NODE_ENV=production`)
- Atomic `markPaid` + auto-refund on stock failure; webhook `payment_status` + async/expired events
- Invoices (PDF + sequential numbers); shipments (carrier/tracking + email)
- Partial refunds with Stripe idempotency; paid cancel routes through refund
- Server free-shipping threshold; checkout shows shipping + VAT before pay; terms consent
- Sentry in API filter + worker; notification job retries
- Returns (RMA), subscriptions (subscribe-and-save), abandoned-cart enqueue
- Guest order lookup; customer address-book CRUD
- Admin editors: shipping zones, tax rates, CMS pages, returns, subscriptions, free-ship setting

### Still thin / verify before real traffic

- TLS/reverse proxy not bundled (compose exposes via `expose`, not public ports)
- Stripe Payment Method types come from Dashboard (enable Klarna/PayPal/SEPA for hosted Checkout; Link/PayPal/Apple Pay/Google Pay for Express Checkout Element; set `PUBLIC_STRIPE_PUBLISHABLE_KEY`)
- Apple Pay needs HTTPS + a registered payment-method domain (will not appear on `http://localhost`)
- Full DB integration tests for concurrent `markPaid` are covered by e2e mock path + unit invariants; add `stripe-mock` if you harden further
- Static Astro PDP stock/price still bake at build time

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
- [ADRs](docs/adr/) (incl. [0010 express checkout](docs/adr/0010-express-checkout.md))
- [Backup/restore](docs/runbooks/backup-restore.md)
- [Production deploy](docs/runbooks/production-deploy.md)
- [Stuck orders](docs/runbooks/stuck-orders.md)

## Modules

Catalog (variants + metafields + nested collections + facets), inventory, cart, Stripe checkout (hosted Sessions + Express Checkout Element for Link/PayPal/Apple Pay/Google Pay), orders/invoices/shipments, discounts, shipping, tax classes, media, CMS pages/menus, analytics events, notifications, admin RBAC (`owner`/`staff`), reviews, customer accounts (email OTP + Google/Apple OAuth), returns, subscriptions, abandoned cart, multi-currency rates (display; checkout EUR-only).
