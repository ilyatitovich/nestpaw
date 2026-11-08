import {
  type Stripe,
  type StripeElements,
  type StripeExpressCheckoutElement,
  type StripeExpressCheckoutElementConfirmEvent,
  type StripeExpressCheckoutElementReadyEvent,
  type StripeExpressCheckoutElementShippingAddressChangeEvent,
  type StripeExpressCheckoutElementShippingRateChangeEvent,
  loadStripe,
} from "@stripe/stripe-js";
import { useEffect, useRef, useState } from "react";
import { localizePath } from "@/i18n/ui";
import { CHECKOUT_COUNTRIES } from "@/lib/checkout-validation";
import { getCustomerAccessToken } from "@/lib/customer-auth";

type QuoteRate = {
  id: string;
  displayName: string;
  amount: number;
};

type QuoteResponse = {
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  freeShipping: boolean;
  shippingRates: QuoteRate[];
};

type Props = {
  apiUrl: string;
  locale: string;
  storeUrl: string;
  publishableKey: string;
  cartToken: string;
  merchandiseTotal: number;
  acceptTerms: boolean;
  termsCheckboxId: string;
  labels: {
    title: string;
    or: string;
    termsRequired: string;
    errorGeneric: string;
  };
  onError: (message: string) => void;
  onBusy: (busy: boolean) => void;
};

function splitName(full: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Customer", lastName: "Guest" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "-" };
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(" "),
  };
}

function lineItemsFromQuote(quote: QuoteResponse) {
  const items: { name: string; amount: number }[] = [
    { name: "Subtotal", amount: quote.subtotal },
  ];
  if (quote.discountTotal > 0) {
    items.push({ name: "Discount", amount: -quote.discountTotal });
  }
  items.push({ name: "Shipping", amount: quote.shippingTotal });
  return items;
}

export default function ExpressCheckout({
  apiUrl,
  locale,
  storeUrl,
  publishableKey,
  cartToken,
  merchandiseTotal,
  acceptTerms,
  termsCheckboxId,
  labels,
  onError,
  onBusy,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const acceptTermsRef = useRef(acceptTerms);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const expressRef = useRef<StripeExpressCheckoutElement | null>(null);
  const quoteRef = useRef<QuoteResponse | null>(null);
  const rateIdRef = useRef<string | undefined>(undefined);
  const countryRef = useRef<string>(CHECKOUT_COUNTRIES[0]);
  const idempotencyKey = useRef(crypto.randomUUID());

  const [visible, setVisible] = useState(false);
  const [absent, setAbsent] = useState(false);

  acceptTermsRef.current = acceptTerms;

  useEffect(() => {
    if (!publishableKey || !mountRef.current || merchandiseTotal <= 0) return;

    let cancelled = false;
    let express: StripeExpressCheckoutElement | null = null;

    async function fetchQuote(
      country: string,
      shippingRateId?: string,
    ): Promise<QuoteResponse | null> {
      const params = new URLSearchParams({ country });
      if (shippingRateId) params.set("shippingRateId", shippingRateId);
      const res = await fetch(`${apiUrl}/checkout/quote?${params}`, {
        headers: { "X-Cart-Token": cartToken },
      });
      if (!res.ok) return null;
      return (await res.json()) as QuoteResponse;
    }

    async function init() {
      const stripe = await loadStripe(publishableKey);
      if (!stripe || cancelled || !mountRef.current) return;
      stripeRef.current = stripe;

      const elements = stripe.elements({
        mode: "payment",
        amount: merchandiseTotal,
        currency: "eur",
        locale: locale === "de" ? "de" : "en",
      });
      elementsRef.current = elements;

      express = elements.create("expressCheckout", {
        buttonHeight: 44,
        emailRequired: true,
        shippingAddressRequired: true,
        allowedShippingCountries: [...CHECKOUT_COUNTRIES],
        paymentMethods: {
          applePay: "always",
          googlePay: "always",
          link: "auto",
          paypal: "auto",
          amazonPay: "never",
          klarna: "never",
        },
        layout: { maxColumns: 4, maxRows: 1, overflow: "auto" },
      });
      expressRef.current = express;

      express.on("ready", (event: StripeExpressCheckoutElementReadyEvent) => {
        const available = event.availablePaymentMethods;
        const hasAny =
          available && Object.values(available).some((v) => v === true);
        if (!hasAny) {
          setVisible(false);
          setAbsent(true);
          express?.unmount();
          return;
        }
        setAbsent(false);
        setVisible(true);
      });

      express.on("click", (event) => {
        if (!acceptTermsRef.current) {
          event.reject();
          onError(labels.termsRequired);
          document.getElementById(termsCheckboxId)?.focus();
          return;
        }
        event.resolve({
          emailRequired: true,
          shippingAddressRequired: true,
          phoneNumberRequired: false,
        });
      });

      express.on(
        "shippingaddresschange",
        async (
          event: StripeExpressCheckoutElementShippingAddressChangeEvent,
        ) => {
          const country = (event.address.country ?? "").toUpperCase();
          if (
            !(CHECKOUT_COUNTRIES as readonly string[]).includes(country)
          ) {
            event.reject();
            return;
          }
          try {
            const quote = await fetchQuote(country);
            if (!quote || quote.shippingRates.length === 0) {
              event.reject();
              return;
            }
            countryRef.current = country;
            quoteRef.current = quote;
            rateIdRef.current = quote.shippingRates[0]?.id;
            elements.update({ amount: quote.total });
            event.resolve({
              shippingRates: quote.shippingRates.map((r) => ({
                id: r.id,
                displayName: r.displayName,
                amount: r.amount,
              })),
              lineItems: lineItemsFromQuote(quote),
            });
          } catch {
            event.reject();
          }
        },
      );

      express.on(
        "shippingratechange",
        async (event: StripeExpressCheckoutElementShippingRateChangeEvent) => {
          const rateId = event.shippingRate.id;
          try {
            const quote = await fetchQuote(countryRef.current, rateId);
            if (!quote) {
              event.reject();
              return;
            }
            quoteRef.current = quote;
            rateIdRef.current = rateId;
            elements.update({ amount: quote.total });
            event.resolve({
              lineItems: lineItemsFromQuote(quote),
            });
          } catch {
            event.reject();
          }
        },
      );

      express.on(
        "confirm",
        async (event: StripeExpressCheckoutElementConfirmEvent) => {
          if (!acceptTermsRef.current) {
            event.paymentFailed({
              reason: "fail",
              message: labels.termsRequired,
            });
            onError(labels.termsRequired);
            return;
          }

          const shipping = event.shippingAddress;
          const email =
            event.billingDetails?.email ??
            (event as { email?: string }).email;
          if (!shipping?.address || !email) {
            event.paymentFailed({
              reason: "invalid_shipping_address",
              message: labels.errorGeneric,
            });
            return;
          }

          const { firstName, lastName } = splitName(shipping.name);
          const addr = shipping.address;
          const country = (addr.country ?? "").toUpperCase();
          const shippingRateId =
            event.shippingRate?.id ?? rateIdRef.current;

          onBusy(true);
          onError("");

          try {
            await fetch(`${apiUrl}/analytics/events`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: "begin_checkout",
                payload: { express: true },
                locale,
              }),
            }).catch(() => undefined);

            const customerToken = getCustomerAccessToken();
            const successUrl = `${storeUrl}${localizePath(locale, "/checkout/success")}`;

            const res = await fetch(`${apiUrl}/checkout/express`, {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-Cart-Token": cartToken,
                "Idempotency-Key": idempotencyKey.current,
                ...(customerToken
                  ? { Authorization: `Bearer ${customerToken}` }
                  : {}),
              },
              body: JSON.stringify({
                shippingAddress: {
                  firstName,
                  lastName,
                  email,
                  phone: event.billingDetails?.phone || undefined,
                  line1: addr.line1 ?? "",
                  line2: addr.line2 || undefined,
                  city: addr.city ?? "",
                  postalCode: addr.postal_code ?? "",
                  country,
                  state: addr.state || undefined,
                },
                shippingRateId,
                locale,
                currency: "EUR",
                acceptTerms: true,
                successUrl,
              }),
            });

            if (!res.ok) {
              const body = (await res.json()) as { message?: string };
              throw new Error(body.message ?? labels.errorGeneric);
            }

            const data = (await res.json()) as {
              clientSecret: string;
              orderId: string;
            };

            if (data.clientSecret.includes("_secret_mock")) {
              await fetch(`${apiUrl}/payments/mock-complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  paymentIntentId: data.clientSecret.replace(
                    /_secret_mock$/,
                    "",
                  ),
                }),
              });
              window.location.href = `${successUrl}?payment_intent=${encodeURIComponent(
                data.clientSecret.replace(/_secret_mock$/, ""),
              )}&redirect_status=succeeded&mock=1`;
              return;
            }

            const { error } = await stripe.confirmPayment({
              elements,
              clientSecret: data.clientSecret,
              confirmParams: {
                return_url: successUrl,
              },
            });

            if (error) {
              event.paymentFailed({
                reason: "fail",
                message: error.message ?? labels.errorGeneric,
              });
              onError(error.message ?? labels.errorGeneric);
              onBusy(false);
            }
          } catch (err) {
            const message =
              err instanceof Error ? err.message : labels.errorGeneric;
            event.paymentFailed({ reason: "fail", message });
            onError(message);
            onBusy(false);
          }
        },
      );

      express.mount(mountRef.current);
    }

    void init();

    return () => {
      cancelled = true;
      express?.unmount();
      expressRef.current = null;
      elementsRef.current = null;
      stripeRef.current = null;
    };
  }, [
    apiUrl,
    cartToken,
    labels.errorGeneric,
    labels.termsRequired,
    locale,
    merchandiseTotal,
    onBusy,
    onError,
    publishableKey,
    storeUrl,
    termsCheckboxId,
  ]);

  // Keep amount in sync when cart merchandise changes outside the sheet
  useEffect(() => {
    if (!elementsRef.current || merchandiseTotal <= 0) return;
    const quote = quoteRef.current;
    elementsRef.current.update({
      amount: quote?.total ?? merchandiseTotal,
    });
  }, [merchandiseTotal]);

  if (absent) return null;

  return (
    <div
      className={`express-checkout${visible ? " express-checkout--ready" : ""}`}
      aria-hidden={!visible}
    >
      {visible ? (
        <p className="express-checkout__title">{labels.title}</p>
      ) : null}
      <div ref={mountRef} className="express-checkout__element" />
      {visible ? (
        <div className="express-checkout__divider" role="separator">
          <span>{labels.or}</span>
        </div>
      ) : null}
    </div>
  );
}
