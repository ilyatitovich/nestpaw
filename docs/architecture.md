# Architecture

Single-brand commerce monorepo:

- `apps/storefront` — Astro static storefront (CDN)
- `apps/admin` — React 19 admin SPA (Docker/nginx)
- `apps/api` — NestJS API + BullMQ worker (Docker)
- `packages/*` — shared types, API client, tokens, tsconfig

## Customer auth

Storefront account sign-in is passwordless (email OTP and optional Google/Apple OAuth) with short-lived access JWTs plus HttpOnly refresh cookies. Admin remains email/password. Details: `docs/runbooks/customer-auth.md`, ADR `docs/adr/0006-customer-passwordless-auth.md`.

## Money path

1. Storefront cart uses `X-Cart-Token`; guest enters shipping on checkout (signed-in customers send Bearer so `Order.customerId` is set)
2. `GET /checkout/quote` previews **gross** totals (VAT included) with server free-shipping threshold
3. `POST /checkout` (requires `acceptTerms: true`) creates `Order` (`pending_payment`) + Stripe Checkout Session whose `amount_total` matches `Order.total`
4. Stripe webhook (`checkout.session.completed` / `async_payment_succeeded` with `payment_status=paid`) calls atomic `markPaid` (claim via `updateMany`, decrement stock, invoice number, email job)
5. Insufficient stock after charge → auto-refund + order `refunded` + Sentry alert
6. `checkout.session.expired` / `async_payment_failed` → cancel pending order
7. Admin fulfills with carrier/tracking (ships email); refunds support partial amounts with Stripe idempotency keys

Mock payments require `ALLOW_MOCK_PAYMENTS` and are disabled when `NODE_ENV=production`.

### Failure modes

| Failure | Behavior |
| --- | --- |
| Stock gone at pay | Auto Stripe refund; order `refunded`; Sentry |
| Duplicate webhook | `StripeEvent.processed` + atomic status claim |
| Async unpaid session | Ignore until `payment_status=paid` |
| SMTP down | BullMQ retries order-paid / order-shipped jobs |
| Cancel paid order | Routes through Stripe refund |

## Pricing & tax

Prices are **gross (VAT-inclusive)**. Products have `taxClass` (`standard` / `reduced`). `taxTotal` on orders is extracted for invoices, not added on top. Free shipping threshold is stored in `StoreSetting.free_shipping_threshold_cents` (default €49).

## Customization

- Design tokens: `packages/ui-tokens/tokens.css`
- CMS pages + menu handles via admin API (Impressum, Widerruf seeded)
- Product metafields for unknown verticals; server-side PLP facets (`lifeStage`, `productType`, `species`, price, sort)
- Locales: `en`, `de`

## Deploy

- Storefront → Cloudflare Pages
- API/Admin/Postgres/Redis → Docker Compose on VPS (`docker/docker-compose.prod.yml`: migrate job, Redis AOF+password, ready healthchecks, TLS at reverse proxy)
- Media → MinIO locally, Cloudflare R2 in production
