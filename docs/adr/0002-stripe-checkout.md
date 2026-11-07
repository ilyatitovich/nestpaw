# ADR 0002: Stripe Checkout for v1 payments

## Context
SMB store needs PCI-light payments quickly.

## Decision
Use Stripe Checkout Sessions + signed webhooks. Mock checkout when `STRIPE_SECRET_KEY` is unset/placeholder.

## Consequences
Custom Elements checkout deferred. Idempotency via `Idempotency-Key` + `StripeEvent` dedupe.
