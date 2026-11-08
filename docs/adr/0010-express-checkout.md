# ADR 0010: Stripe Express Checkout Element

## Context

Checkout collects a shipping form, then redirects to a Stripe Checkout Session. Wallet buttons (Apple Pay, Google Pay, PayPal, Link) only appear on Stripe’s hosted page after the customer has already typed an address. Shopify-style express checkout puts those wallets above the form.

Shop Pay is closed to Shopify. Stripe’s equivalent is Link. ADR 0002 deferred a full Elements checkout; this ADR adds a narrow express path only.

## Decision

- Mount Stripe’s **Express Checkout Element** on the storefront checkout page (`en` / `de`).
- On confirm, `POST /checkout/express` creates the same `pending_payment` order shape as hosted checkout, then a **PaymentIntent** for the server-computed EUR total.
- Show Link, PayPal, Apple Pay, Google Pay when Stripe reports them. Hide Klarna and Amazon Pay on the express row.
- Terms acceptance gates wallet `click` (German distance-selling). Amount always comes from server quote / order creation.
- Webhooks: `payment_intent.succeeded` → `markPaid`; `payment_intent.payment_failed` / `canceled` → `expirePending` while still `pending_payment`. Session `payment_status=paid` rule unchanged. `markPaid` remains idempotent if both session and PI events fire.
- The address-form “order with obligation to pay” path now uses the Payment Element (ADR 0011), not Checkout Sessions.

## Consequences

- Requires `PUBLIC_STRIPE_PUBLISHABLE_KEY`, Dashboard payment methods, and production payment-method domain registration (Apple Pay will not show on plain `http://localhost`).
- Mock path returns `pi_test_mock_*` client secrets when Stripe is unset and `ALLOW_MOCK_PAYMENTS` is on.
- Cart drawer / PDP buy-now express and Shop Pay branding remain out of scope.
- Standard checkout sessions are no longer created for new storefront orders (see ADR 0011).
