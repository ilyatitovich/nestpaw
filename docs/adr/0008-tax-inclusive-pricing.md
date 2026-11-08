# ADR 0008 — Tax-inclusive (gross) pricing

## Context

DACH B2C shops must show VAT-inclusive prices (PAngV). The first implementation stored net prices and added VAT at checkout, which was wrong for storefront display and Stripe line items.

## Decision

- Store variant prices as **gross EUR cents**
- Product `taxClass`: `standard` | `reduced` (DE 19%/7%, AT 20%/10%)
- Order `taxTotal` = VAT **extracted** from gross for invoices
- Checkout currency forced to EUR until server-side FX is live
- Free-shipping threshold enforced server-side via `StoreSetting`

## Consequences

Stripe line items no longer include a separate Tax line. Invoices show VAT included. Multi-currency display rates remain informational only.
