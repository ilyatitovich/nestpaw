# Runbook — Stuck / failed orders

## Symptoms

- Customer charged but order still `pending_payment`
- Order `refunded` with audit `order.stock_fail_refund`
- Webhook retries in Stripe dashboard

## Checks

1. API / worker logs and Sentry for `insufficient_stock_after_pay` or `stock_fail_refund`
2. `StripeEvent` rows for the session (`processed` flag)
3. Order transitions / audit logs
4. Stripe payment intent refunds

## Actions

| Situation | Action |
| --- | --- |
| Stock fail auto-refund succeeded | Confirm customer refund in Stripe; restock if needed; contact customer |
| Auto-refund failed | Manually refund PaymentIntent; set order `refunded`; capture incident |
| Session expired, order pending | Expect `cancelled` from `checkout.session.expired`; if not, `POST` cancel in admin |
| Paid but no invoice | Re-run markPaid is no-op if already paid; invoice assigned only on successful claim |

## Prevention

Atomic `markPaid`, `payment_status=paid` gate, stock pre-check at checkout, Sentry alerts.
