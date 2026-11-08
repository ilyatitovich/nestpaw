# ADR 0007 — Inventory commitment

## Context

Stock was checked at add-to-cart and decremented at pay without a reservation. Concurrent checkouts could charge a customer for an unfulfillable order.

## Decision

**Decrement-at-pay + auto-refund on failure**, with an atomic `pending_payment → paid` claim:

1. Pre-check stock at checkout create
2. On webhook paid: `updateMany` where `pending_payment`, then decrement in the same transaction
3. If decrement fails: Stripe refund, mark order `refunded`, capture in Sentry

## Alternatives

- Soft reservation at checkout with TTL — better for high contention; more moving parts
- Oversell with manual resolution — unacceptable for a specialty shop

## Consequences

No hold between checkout and pay. Short window of oversell risk remains; recovery is automatic refund rather than stuck `pending_payment`.
