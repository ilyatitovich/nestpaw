# Case study — Paid but out of stock

## Problem

Between add-to-cart and Stripe webhook, another buyer can take the last unit. Decrementing stock only at pay left customers charged with orders stuck in `pending_payment`.

## Approach

1. Pre-check stock when creating checkout
2. Atomically claim `pending_payment → paid` inside a transaction
3. Decrement with conditional `updateMany` (deny policy)
4. On failure: auto-refund via Stripe idempotency key, mark `refunded`, Sentry alert

## Why not soft reservation

Reservation + TTL is correct at higher volume. For this portfolio shop, auto-refund is fewer moving parts and still demonstrates failure-mode thinking.

## Verification

- Unit: `canFulfillDenyPolicy`, webhook `payment_status` gate
- E2E: mock checkout → mock-complete money path in CI
