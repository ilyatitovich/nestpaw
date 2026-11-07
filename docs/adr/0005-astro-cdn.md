# ADR 0005: Astro static storefront on CDN

## Context

SEO and TTFB matter more than server-rendered personalization for SMB catalog.

## Decision

Astro `output: "static"` with React islands for cart/checkout/account. Deploy to Cloudflare Pages.

## Consequences

Rebuild/redeploy (or on-demand ISR later) when catalog changes. API remains source of truth for cart and money.
