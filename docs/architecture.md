# Architecture

Single-brand commerce monorepo:

- `apps/storefront` — Astro static storefront (CDN)
- `apps/admin` — React 19 admin SPA (Docker/nginx)
- `apps/api` — NestJS API + BullMQ worker (Docker)
- `packages/*` — shared types, API client, tokens, tsconfig

## Money path

1. Storefront cart uses `X-Cart-Token`
2. `POST /checkout` creates `Order` (`pending_payment`) + Stripe Checkout Session
3. Stripe webhook marks order `paid`, decrements inventory, queues email
4. Admin fulfills / refunds / cancels

## Customization

- Design tokens: `packages/ui-tokens/tokens.css`
- CMS pages + menu handles via admin API
- Product metafields for unknown verticals
- Locales: `en`, `de` (extend `STORE_LOCALES` + i18n dictionaries)

## Deploy

- Storefront → Cloudflare Pages
- API/Admin/Postgres/Redis → Docker Compose on VPS
- Media → MinIO locally, Cloudflare R2 in production
