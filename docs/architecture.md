# Architecture

Single-brand commerce monorepo:

- `apps/storefront` — Astro static storefront (CDN)
- `apps/admin` — React 19 admin SPA (Docker/nginx)
- `apps/api` — NestJS API + BullMQ worker (Docker)
- `packages/*` — shared types, API client, tokens, tsconfig

## Money path

1. Storefront cart uses `X-Cart-Token`; guest enters shipping on cart checkout form
2. `POST /checkout` creates `Order` (`pending_payment`) + Stripe Checkout Session whose `amount_total` matches `Order.total` (discounts applied to line items)
3. Stripe webhook (or gated mock-complete in non-prod) marks order `paid`, decrements inventory atomically, queues email; success page clears the cart
4. Admin fulfills / refunds / cancels (paid cancel & refund restock inventory)

Mock payments require `ALLOW_MOCK_PAYMENTS` and are disabled when `NODE_ENV=production`.

## Customization

- Design tokens: `packages/ui-tokens/tokens.css`
- CMS pages + menu handles via admin API
- Product metafields for unknown verticals
- Locales: `en`, `de` (extend `STORE_LOCALES` + i18n dictionaries)

## Deploy

- Storefront → Cloudflare Pages
- API/Admin/Postgres/Redis → Docker Compose on VPS
- Media → MinIO locally, Cloudflare R2 in production
