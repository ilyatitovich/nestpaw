# ADR 0011: Embedded 3-step checkout with Payment Element

## Context

ADR 0002 used Stripe Checkout Sessions so v1 could take PCI-light card payments quickly. ADR 0010 added Express Checkout Element wallets on the storefront, but the standard path still redirected to `checkout.stripe.com` after the customer typed an address. That forced a second address entry, hid shipping-method choice on our page, and never showed a card form under our brand.

## Decision

- Replace the storefront standard path with a **3-step checkout** on `/checkout`: contact and delivery → shipping method → payment.
- Collect payment with Stripe’s **Payment Element** (deferred intent: mount with amount/currency, then `POST /checkout` creates a PaymentIntent and the client confirms).
- Keep **Express Checkout Element** on step 1 for wallets.
- Keep Checkout Session webhook handlers for in-flight sessions; new storefront checkouts do not create sessions.
- Reject a `shippingRateId` that is not eligible for the destination country and cart weight.
- Optional `billingAddress` on the order; invoices prefer it when set.

## Consequences

- Card data stays in Stripe iframes (PCI SAQ A).
- Klarna / PayPal / SEPA appear inside the Payment Element when enabled in the Dashboard (no second host).
- Mock path returns `pi_test_mock_*` client secrets when Stripe is unset and `ALLOW_MOCK_PAYMENTS` is on.
- ADR 0002’s “Elements deferred” note and ADR 0010’s “sessions stay for the standard path” are superseded for new checkouts.
