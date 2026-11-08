import { useCallback, useEffect, useId, useRef, useState } from "react";
import { localizePath } from "@/i18n/ui";
import {
  CHECKOUT_COUNTRIES,
  type CheckoutField,
  type CheckoutFieldErrors,
  type CheckoutShippingForm,
  type CheckoutValidationLabels,
  emptyShippingForm,
  firstCheckoutErrorField,
  toShippingAddressPayload,
  validateCheckoutField,
  validateCheckoutForm,
} from "@/lib/checkout-validation";
import {
  type AccountAddress,
  fetchCustomerMe,
  refreshCustomerSession,
} from "@/lib/customer-account";
import {
  getCustomerAccessToken,
  setCustomerAccessToken,
} from "@/lib/customer-auth";
import FieldError from "./account/FieldError";
import ExpressCheckout from "./ExpressCheckout";
import PaymentCheckout, {
  type PaymentBillingDetails,
  type PaymentCheckoutHandle,
} from "./PaymentCheckout";

type Cart = {
  token: string;
  lines: {
    id: string;
    quantity: number;
    variant: {
      price: number;
      product: { translations: { locale: string; title: string }[] };
    };
  }[];
  totals: {
    subtotal: number;
    discountTotal: number;
    total: number;
    currency: string;
  };
  discountCode?: string | null;
};

type ShippingRate = {
  id: string;
  displayName: string;
  amount: number;
};

type Quote = {
  shippingTotal: number;
  taxTotal: number;
  total: number;
  freeShipping: boolean;
  shippingRateId: string | null;
  shippingRates: ShippingRate[];
};

type CheckoutStep = "information" | "shipping" | "payment";

type Props = {
  apiUrl: string;
  locale: string;
  storeUrl: string;
  cartHref: string;
  stripePublishableKey?: string;
  labels: {
    contact: string;
    delivery: string;
    shipping: string;
    shippingMethod: string;
    payment: string;
    orderSummary: string;
    paySecurely: string;
    secureNote: string;
    taxesNote: string;
    emptyRedirect: string;
    editCart: string;
    firstName: string;
    lastName: string;
    email: string;
    line1: string;
    line2: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
    countryDE: string;
    countryAT: string;
    countryFR: string;
    countryNL: string;
    countryBE: string;
    subtotal: string;
    discountLabel: string;
    total: string;
    shippingCost: string;
    vatIncluded: string;
    acceptTerms: string;
    payObligation: string;
    termsRequired: string;
    expressTitle: string;
    expressOr: string;
    continue: string;
    returnTo: string;
    edit: string;
    freeShipping: string;
    savedAddresses: string;
    newAddress: string;
    billingDifferent: string;
    billingAddress: string;
    paymentUnavailable: string;
    shippingRequired: string;
    showSummary: string;
    hideSummary: string;
    errorGeneric: string;
    errorLoad: string;
  } & CheckoutValidationLabels;
};

function formatMoney(cents: number, locale: string, currency = "EUR") {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-IE", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function focusField(id: string) {
  document.getElementById(id)?.focus();
}

function addressFromSaved(
  address: AccountAddress,
  email: string,
): CheckoutShippingForm {
  return {
    firstName: address.firstName,
    lastName: address.lastName,
    email,
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    postalCode: address.postalCode,
    country: address.country,
    phone: address.phone ?? "",
  };
}

function toBillingPayload(form: CheckoutShippingForm) {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    line1: form.line1.trim(),
    line2: form.line2.trim() || undefined,
    city: form.city.trim(),
    postalCode: form.postalCode.trim(),
    country: form.country.trim().toUpperCase(),
    phone: form.phone.trim() || undefined,
  };
}

function toStripeBilling(
  form: CheckoutShippingForm,
  email: string,
): PaymentBillingDetails {
  return {
    name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
    email,
    phone: form.phone.trim() || undefined,
    address: {
      line1: form.line1.trim(),
      line2: form.line2.trim() || undefined,
      city: form.city.trim(),
      postal_code: form.postalCode.trim(),
      country: form.country.trim().toUpperCase(),
    },
  };
}

export default function CheckoutClient({
  apiUrl,
  locale,
  storeUrl,
  cartHref,
  stripePublishableKey = "",
  labels,
}: Props) {
  const baseId = useId();
  const termsId = `${baseId}-terms`;
  const termsPayId = `${baseId}-terms-pay`;
  const fieldIds: Record<CheckoutField, string> = {
    firstName: `${baseId}-first`,
    lastName: `${baseId}-last`,
    email: `${baseId}-email`,
    line1: `${baseId}-line1`,
    line2: `${baseId}-line2`,
    city: `${baseId}-city`,
    postalCode: `${baseId}-postal`,
    country: `${baseId}-country`,
    phone: `${baseId}-phone`,
  };
  const errorIds: Record<CheckoutField, string> = {
    firstName: `${baseId}-first-error`,
    lastName: `${baseId}-last-error`,
    email: `${baseId}-email-error`,
    line1: `${baseId}-line1-error`,
    line2: `${baseId}-line2-error`,
    city: `${baseId}-city-error`,
    postalCode: `${baseId}-postal-error`,
    country: `${baseId}-country-error`,
    phone: `${baseId}-phone-error`,
  };
  const billingFieldIds: Record<CheckoutField, string> = {
    firstName: `${baseId}-bill-first`,
    lastName: `${baseId}-bill-last`,
    email: `${baseId}-bill-email`,
    line1: `${baseId}-bill-line1`,
    line2: `${baseId}-bill-line2`,
    city: `${baseId}-bill-city`,
    postalCode: `${baseId}-bill-postal`,
    country: `${baseId}-bill-country`,
    phone: `${baseId}-bill-phone`,
  };
  const billingErrorIds: Record<CheckoutField, string> = {
    firstName: `${baseId}-bill-first-error`,
    lastName: `${baseId}-bill-last-error`,
    email: `${baseId}-bill-email-error`,
    line1: `${baseId}-bill-line1-error`,
    line2: `${baseId}-bill-line2-error`,
    city: `${baseId}-bill-city-error`,
    postalCode: `${baseId}-bill-postal-error`,
    country: `${baseId}-bill-country-error`,
    phone: `${baseId}-bill-phone-error`,
  };

  const paymentRef = useRef<PaymentCheckoutHandle | null>(null);

  const [cart, setCart] = useState<Cart | null>(null);
  const [shipping, setShipping] = useState<CheckoutShippingForm>(
    emptyShippingForm(),
  );
  const [billing, setBilling] = useState<CheckoutShippingForm>(
    emptyShippingForm(),
  );
  const [billingDifferent, setBillingDifferent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [billingErrors, setBillingErrors] = useState<CheckoutFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [quote, setQuote] = useState<Quote | null>(null);
  const [shippingRateId, setShippingRateId] = useState<string | null>(null);
  const [step, setStep] = useState<CheckoutStep>("information");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<AccountAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new">(
    "new",
  );
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);

  const validationLabels: CheckoutValidationLabels = {
    errorRequired: labels.errorRequired,
    errorEmailInvalid: labels.errorEmailInvalid,
    errorNameInvalid: labels.errorNameInvalid,
    errorPostalInvalid: labels.errorPostalInvalid,
    errorCountryInvalid: labels.errorCountryInvalid,
    errorPhoneInvalid: labels.errorPhoneInvalid,
  };

  async function load() {
    const token = localStorage.getItem("cart_token");
    const res = await fetch(`${apiUrl}/cart`, {
      headers: token ? { "X-Cart-Token": token } : {},
    });
    if (!res.ok) throw new Error(labels.errorLoad);
    const data = (await res.json()) as Cart;
    const header = res.headers.get("X-Cart-Token");
    if (header) localStorage.setItem("cart_token", header);
    else localStorage.setItem("cart_token", data.token);
    setCart(data);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only checkout load + session restore
  useEffect(() => {
    load().catch(() => setError(labels.errorLoad));
    void (async () => {
      try {
        let token = getCustomerAccessToken();
        if (!token) {
          token = await refreshCustomerSession(apiUrl);
        }
        if (!token) return;
        setCustomerAccessToken(token);
        const me = await fetchCustomerMe(apiUrl, token);
        if (!me) return;
        setCustomerEmail(me.email);
        const addresses = me.addresses ?? [];
        setSavedAddresses(addresses);
        if (addresses.length) {
          const preferred =
            addresses.find((a) => a.isDefault) ?? addresses[0];
          if (preferred) {
            setSelectedAddressId(preferred.id);
            setShipping(addressFromSaved(preferred, me.email));
          }
        } else if (me.email) {
          setShipping((s) => ({ ...s, email: me.email }));
        }
      } catch {
        /* guest checkout */
      }
    })();
  }, []);

  const fetchQuote = useCallback(
    async (country: string, rateId?: string | null) => {
      if (!cart?.token || !country) return;
      const params = new URLSearchParams({ country });
      if (rateId) params.set("shippingRateId", rateId);
      const res = await fetch(`${apiUrl}/checkout/quote?${params}`, {
        headers: { "X-Cart-Token": cart.token },
      });
      if (!res.ok) return;
      const data = (await res.json()) as Quote;
      setQuote(data);
      const nextRate =
        data.shippingRates.find((r) => r.id === rateId)?.id ??
        data.shippingRateId ??
        data.shippingRates[0]?.id ??
        null;
      setShippingRateId(nextRate);
    },
    [apiUrl, cart?.token],
  );

  useEffect(() => {
    if (!cart?.token || !shipping.country) return;
    const timer = window.setTimeout(() => {
      void fetchQuote(shipping.country, null);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [cart?.token, shipping.country, fetchQuote]);

  function clearFieldError(field: CheckoutField) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function updateField<K extends CheckoutField>(key: K, value: string) {
    setShipping((s) => ({ ...s, [key]: value }));
    clearFieldError(key);
    if (selectedAddressId !== "new") setSelectedAddressId("new");
  }

  function updateBillingField<K extends CheckoutField>(key: K, value: string) {
    setBilling((s) => ({ ...s, [key]: value }));
    setBillingErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function onBlurField(field: CheckoutField) {
    const message = validateCheckoutField(
      field,
      shipping[field],
      validationLabels,
    );
    setFieldErrors((prev) => {
      if (message) return { ...prev, [field]: message };
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function onBlurBillingField(field: CheckoutField) {
    if (field === "email") return;
    const message = validateCheckoutField(
      field,
      billing[field],
      validationLabels,
    );
    setBillingErrors((prev) => {
      if (message) return { ...prev, [field]: message };
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function focusFirstError(
    errors: CheckoutFieldErrors,
    ids: Record<CheckoutField, string>,
  ) {
    const field = firstCheckoutErrorField(errors);
    if (!field) return;
    focusField(ids[field]);
  }

  const onExpressError = useCallback((message: string) => {
    setError(message || null);
  }, []);

  const onExpressBusy = useCallback((next: boolean) => {
    setBusy(next);
  }, []);

  function goToStep(next: CheckoutStep) {
    setError(null);
    setStep(next);
  }

  function onContinueInformation(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateCheckoutForm(shipping, validationLabels);
    if (!result.ok) {
      setFieldErrors(result.errors);
      focusFirstError(result.errors, fieldIds);
      return;
    }
    if (!acceptTerms) {
      setError(labels.termsRequired);
      focusField(termsId);
      return;
    }
    void fetchQuote(shipping.country, shippingRateId).then(() => {
      goToStep("shipping");
    });
  }

  function onContinueShipping(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shippingRateId) {
      setError(labels.shippingRequired);
      return;
    }
    goToStep("payment");
  }

  async function onPay(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart || submitting) return;

    const shipResult = validateCheckoutForm(shipping, validationLabels);
    if (!shipResult.ok) {
      setFieldErrors(shipResult.errors);
      goToStep("information");
      focusFirstError(shipResult.errors, fieldIds);
      return;
    }

    if (billingDifferent) {
      const billForm: CheckoutShippingForm = {
        ...billing,
        email: shipping.email,
      };
      const billResult = validateCheckoutForm(billForm, validationLabels);
      if (!billResult.ok) {
        const { email: _email, ...rest } = billResult.errors;
        setBillingErrors(rest);
        focusFirstError(rest, billingFieldIds);
        return;
      }
    }

    if (!shippingRateId) {
      setError(labels.shippingRequired);
      goToStep("shipping");
      return;
    }
    if (!acceptTerms) {
      setError(labels.termsRequired);
      focusField(termsPayId);
      return;
    }

    setSubmitting(true);
    setBusy(true);
    setError(null);

    try {
      const payment = paymentRef.current;
      if (stripePublishableKey) {
        if (!payment) {
          throw new Error(labels.paymentUnavailable);
        }
        const submitted = await payment.submitElements();
        if (submitted.error) {
          setError(submitted.error);
          setBusy(false);
          setSubmitting(false);
          return;
        }
      }

      await fetch(`${apiUrl}/analytics/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "begin_checkout", payload: {}, locale }),
      }).catch(() => undefined);

      const customerToken = getCustomerAccessToken();
      const successUrl = `${storeUrl}${localizePath(locale, "/checkout/success")}`;
      const res = await fetch(`${apiUrl}/checkout`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Cart-Token": cart.token,
          "Idempotency-Key": idempotencyKey,
          ...(customerToken
            ? { Authorization: `Bearer ${customerToken}` }
            : {}),
        },
        body: JSON.stringify({
          shippingAddress: toShippingAddressPayload(shipping),
          billingAddress: billingDifferent
            ? toBillingPayload(billing)
            : undefined,
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
            paymentIntentId: data.clientSecret.replace(/_secret_mock$/, ""),
          }),
        });
        window.location.href = `${successUrl}?payment_intent=${encodeURIComponent(
          data.clientSecret.replace(/_secret_mock$/, ""),
        )}&redirect_status=succeeded&mock=1`;
        return;
      }

      if (!stripePublishableKey || !payment) {
        throw new Error(labels.paymentUnavailable);
      }

      const billingDetails = toStripeBilling(
        billingDifferent ? billing : shipping,
        shipping.email.trim(),
      );
      const confirmed = await payment.submitAndConfirm({
        clientSecret: data.clientSecret,
        returnUrl: successUrl,
        billingDetails,
      });
      if (confirmed.error) {
        setError(confirmed.error);
        setBusy(false);
        setSubmitting(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorGeneric);
      setBusy(false);
      setSubmitting(false);
    }
  }

  if (!cart) {
    return (
      <p className="checkout-page__status" role="status">
        {error ?? "…"}
      </p>
    );
  }

  if (!cart.lines.length) {
    return (
      <div className="checkout-page__empty">
        <p>{labels.emptyRedirect}</p>
        <a className="btn btn--primary" href={cartHref}>
          {labels.editCart}
        </a>
      </div>
    );
  }

  const currency = cart.totals.currency || "EUR";
  const countryLabels: Record<(typeof CHECKOUT_COUNTRIES)[number], string> = {
    DE: labels.countryDE,
    AT: labels.countryAT,
    FR: labels.countryFR,
    NL: labels.countryNL,
    BE: labels.countryBE,
  };

  const merchandiseTotal = Math.max(
    0,
    cart.totals.subtotal - (cart.totals.discountTotal ?? 0),
  );

  const stepIndex = step === "information" ? 0 : step === "shipping" ? 1 : 2;

  const informationRecap = [
    shipping.email,
    [shipping.firstName, shipping.lastName].filter(Boolean).join(" "),
    [shipping.postalCode, shipping.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");

  const selectedRate = quote?.shippingRates.find(
    (r) => r.id === shippingRateId,
  );
  const shippingRecap = selectedRate
    ? `${selectedRate.displayName} · ${
        selectedRate.amount === 0
          ? labels.freeShipping
          : formatMoney(selectedRate.amount, locale, currency)
      }`
    : "";

  function renderAddressFields(
    form: CheckoutShippingForm,
    errors: CheckoutFieldErrors,
    ids: Record<CheckoutField, string>,
    errIds: Record<CheckoutField, string>,
    onChange: <K extends CheckoutField>(key: K, value: string) => void,
    onBlur: (field: CheckoutField) => void,
    includeEmail: boolean,
  ) {
    return (
      <>
        {includeEmail ? (
          <div className="account-field">
            <label htmlFor={ids.email}>{labels.email}</label>
            <input
              id={ids.email}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={form.email}
              disabled={busy}
              aria-invalid={Boolean(errors.email) || undefined}
              aria-describedby={errors.email ? errIds.email : undefined}
              onChange={(e) => onChange("email", e.target.value)}
              onBlur={() => onBlur("email")}
            />
            <FieldError id={errIds.email} message={errors.email} />
          </div>
        ) : null}

        <div className="checkout-form__row">
          <div className="account-field">
            <label htmlFor={ids.firstName}>{labels.firstName}</label>
            <input
              id={ids.firstName}
              name="firstName"
              autoComplete="given-name"
              value={form.firstName}
              disabled={busy}
              aria-invalid={Boolean(errors.firstName) || undefined}
              aria-describedby={errors.firstName ? errIds.firstName : undefined}
              onChange={(e) => onChange("firstName", e.target.value)}
              onBlur={() => onBlur("firstName")}
            />
            <FieldError id={errIds.firstName} message={errors.firstName} />
          </div>
          <div className="account-field">
            <label htmlFor={ids.lastName}>{labels.lastName}</label>
            <input
              id={ids.lastName}
              name="lastName"
              autoComplete="family-name"
              value={form.lastName}
              disabled={busy}
              aria-invalid={Boolean(errors.lastName) || undefined}
              aria-describedby={errors.lastName ? errIds.lastName : undefined}
              onChange={(e) => onChange("lastName", e.target.value)}
              onBlur={() => onBlur("lastName")}
            />
            <FieldError id={errIds.lastName} message={errors.lastName} />
          </div>
        </div>

        <div className="account-field">
          <label htmlFor={ids.line1}>{labels.line1}</label>
          <input
            id={ids.line1}
            name="line1"
            autoComplete="address-line1"
            value={form.line1}
            disabled={busy}
            aria-invalid={Boolean(errors.line1) || undefined}
            aria-describedby={errors.line1 ? errIds.line1 : undefined}
            onChange={(e) => onChange("line1", e.target.value)}
            onBlur={() => onBlur("line1")}
          />
          <FieldError id={errIds.line1} message={errors.line1} />
        </div>

        <div className="account-field">
          <label htmlFor={ids.line2}>{labels.line2}</label>
          <input
            id={ids.line2}
            name="line2"
            autoComplete="address-line2"
            value={form.line2}
            disabled={busy}
            aria-invalid={Boolean(errors.line2) || undefined}
            aria-describedby={errors.line2 ? errIds.line2 : undefined}
            onChange={(e) => onChange("line2", e.target.value)}
            onBlur={() => onBlur("line2")}
          />
          <FieldError id={errIds.line2} message={errors.line2} />
        </div>

        <div className="checkout-form__row">
          <div className="account-field">
            <label htmlFor={ids.city}>{labels.city}</label>
            <input
              id={ids.city}
              name="city"
              autoComplete="address-level2"
              value={form.city}
              disabled={busy}
              aria-invalid={Boolean(errors.city) || undefined}
              aria-describedby={errors.city ? errIds.city : undefined}
              onChange={(e) => onChange("city", e.target.value)}
              onBlur={() => onBlur("city")}
            />
            <FieldError id={errIds.city} message={errors.city} />
          </div>
          <div className="account-field">
            <label htmlFor={ids.postalCode}>{labels.postalCode}</label>
            <input
              id={ids.postalCode}
              name="postalCode"
              autoComplete="postal-code"
              value={form.postalCode}
              disabled={busy}
              aria-invalid={Boolean(errors.postalCode) || undefined}
              aria-describedby={
                errors.postalCode ? errIds.postalCode : undefined
              }
              onChange={(e) => onChange("postalCode", e.target.value)}
              onBlur={() => onBlur("postalCode")}
            />
            <FieldError id={errIds.postalCode} message={errors.postalCode} />
          </div>
        </div>

        <div className="checkout-form__row">
          <div className="account-field">
            <label htmlFor={ids.country}>{labels.country}</label>
            <select
              id={ids.country}
              name="country"
              autoComplete="country"
              value={form.country}
              disabled={busy}
              aria-invalid={Boolean(errors.country) || undefined}
              aria-describedby={errors.country ? errIds.country : undefined}
              onChange={(e) => {
                onChange("country", e.target.value);
                if (includeEmail) setShippingRateId(null);
              }}
              onBlur={() => onBlur("country")}
            >
              {CHECKOUT_COUNTRIES.map((code) => (
                <option key={code} value={code}>
                  {countryLabels[code]}
                </option>
              ))}
            </select>
            <FieldError id={errIds.country} message={errors.country} />
          </div>
          <div className="account-field">
            <label htmlFor={ids.phone}>{labels.phone}</label>
            <input
              id={ids.phone}
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={form.phone}
              disabled={busy}
              aria-invalid={Boolean(errors.phone) || undefined}
              aria-describedby={errors.phone ? errIds.phone : undefined}
              onChange={(e) => onChange("phone", e.target.value)}
              onBlur={() => onBlur("phone")}
            />
            <FieldError id={errIds.phone} message={errors.phone} />
          </div>
        </div>
      </>
    );
  }

  const summary = (
    <aside className="checkout-summary">
      <div className="checkout-summary__sticky">
        <button
          type="button"
          className="checkout-summary__toggle"
          aria-expanded={summaryOpen}
          onClick={() => setSummaryOpen((o) => !o)}
        >
          <span>{labels.orderSummary}</span>
          <span>
            {formatMoney(quote?.total ?? cart.totals.total, locale, currency)}
          </span>
          <span className="checkout-summary__toggle-hint">
            {summaryOpen ? labels.hideSummary : labels.showSummary}
          </span>
        </button>
        <div
          className={`checkout-summary__body${summaryOpen ? " is-open" : ""}`}
        >
          <h2 className="checkout-summary__title checkout-summary__title--desktop">
            {labels.orderSummary}
          </h2>
          <ul className="checkout-summary__lines">
            {cart.lines.map((line) => {
              const title =
                line.variant.product.translations.find(
                  (t) => t.locale === locale,
                )?.title ??
                line.variant.product.translations[0]?.title ??
                "Item";
              return (
                <li className="checkout-summary__line" key={line.id}>
                  <span className="checkout-summary__line-title">
                    {title}
                    <span className="checkout-summary__qty">
                      ×{line.quantity}
                    </span>
                  </span>
                  <span>
                    {formatMoney(
                      line.variant.price * line.quantity,
                      locale,
                      currency,
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <dl className="checkout-summary__rows">
            <div className="checkout-summary__row">
              <dt>{labels.subtotal}</dt>
              <dd>{formatMoney(cart.totals.subtotal, locale, currency)}</dd>
            </div>
            {cart.totals.discountTotal > 0 ? (
              <div className="checkout-summary__row">
                <dt>{labels.discountLabel}</dt>
                <dd>
                  −{formatMoney(cart.totals.discountTotal, locale, currency)}
                </dd>
              </div>
            ) : null}
            {quote ? (
              <div className="checkout-summary__row">
                <dt>{labels.shippingCost}</dt>
                <dd>
                  {quote.freeShipping || quote.shippingTotal === 0
                    ? labels.freeShipping
                    : formatMoney(quote.shippingTotal, locale, currency)}
                </dd>
              </div>
            ) : null}
            {quote ? (
              <div className="checkout-summary__row">
                <dt>{labels.vatIncluded}</dt>
                <dd>{formatMoney(quote.taxTotal, locale, currency)}</dd>
              </div>
            ) : null}
            <div className="checkout-summary__row checkout-summary__row--total">
              <dt>{labels.total}</dt>
              <dd>
                {formatMoney(
                  quote?.total ?? cart.totals.total,
                  locale,
                  currency,
                )}
              </dd>
            </div>
          </dl>
          <p className="checkout-summary__taxes">{labels.taxesNote}</p>
          <a className="checkout-summary__edit" href={cartHref}>
            {labels.editCart}
          </a>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="checkout-page">
      <nav className="checkout-steps" aria-label="Checkout">
        {(
          [
            ["information", labels.contact],
            ["shipping", labels.shippingMethod],
            ["payment", labels.payment],
          ] as const
        ).map(([id, label], index) => {
          const completed = index < stepIndex;
          const current = id === step;
          return (
            <div
              key={id}
              className={`checkout-steps__item${current ? " is-current" : ""}${completed ? " is-complete" : ""}`}
            >
              {completed ? (
                <button
                  type="button"
                  className="checkout-steps__link"
                  onClick={() => goToStep(id)}
                  disabled={busy}
                >
                  {label}
                </button>
              ) : (
                <span>{label}</span>
              )}
            </div>
          );
        })}
      </nav>

      <div className="checkout-page__layout">
        <div className="checkout-page__main">
          {step !== "information" ? (
            <div className="checkout-recap">
              <div className="checkout-recap__row">
                <div>
                  <strong>{labels.contact}</strong>
                  <p>{informationRecap}</p>
                </div>
                <button
                  type="button"
                  className="checkout-recap__edit"
                  onClick={() => goToStep("information")}
                  disabled={busy}
                >
                  {labels.edit}
                </button>
              </div>
              {step === "payment" && shippingRecap ? (
                <div className="checkout-recap__row">
                  <div>
                    <strong>{labels.shippingMethod}</strong>
                    <p>{shippingRecap}</p>
                  </div>
                  <button
                    type="button"
                    className="checkout-recap__edit"
                    onClick={() => goToStep("shipping")}
                    disabled={busy}
                  >
                    {labels.edit}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "information" ? (
            <>
              <label className="checkout-form__terms" htmlFor={termsId}>
                <input
                  id={termsId}
                  type="checkbox"
                  checked={acceptTerms}
                  disabled={busy}
                  onChange={(e) => {
                    setAcceptTerms(e.target.checked);
                    if (e.target.checked && error === labels.termsRequired) {
                      setError(null);
                    }
                  }}
                />
                <span>{labels.acceptTerms}</span>
              </label>

              {stripePublishableKey ? (
                <ExpressCheckout
                  apiUrl={apiUrl}
                  locale={locale}
                  storeUrl={storeUrl}
                  publishableKey={stripePublishableKey}
                  cartToken={cart.token}
                  merchandiseTotal={merchandiseTotal}
                  acceptTerms={acceptTerms}
                  termsCheckboxId={termsId}
                  labels={{
                    title: labels.expressTitle,
                    or: labels.expressOr,
                    termsRequired: labels.termsRequired,
                    errorGeneric: labels.errorGeneric,
                  }}
                  onError={onExpressError}
                  onBusy={onExpressBusy}
                />
              ) : null}

              <form
                className="checkout-form account-form"
                noValidate
                onSubmit={onContinueInformation}
              >
                <h2 className="checkout-form__title">{labels.contact}</h2>
                <div className="account-field">
                  <label htmlFor={fieldIds.email}>{labels.email}</label>
                  <input
                    id={fieldIds.email}
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={shipping.email}
                    disabled={busy}
                    aria-invalid={Boolean(fieldErrors.email) || undefined}
                    aria-describedby={
                      fieldErrors.email ? errorIds.email : undefined
                    }
                    onChange={(e) => updateField("email", e.target.value)}
                    onBlur={() => onBlurField("email")}
                  />
                  <FieldError id={errorIds.email} message={fieldErrors.email} />
                </div>

                <h2 className="checkout-form__title">{labels.delivery}</h2>

                {savedAddresses.length > 0 ? (
                  <fieldset className="checkout-saved">
                    <legend>{labels.savedAddresses}</legend>
                    {savedAddresses.map((address) => {
                      const inputId = `${baseId}-addr-${address.id}`;
                      return (
                        <label
                          key={address.id}
                          className="checkout-saved__option"
                          htmlFor={inputId}
                        >
                          <input
                            id={inputId}
                            type="radio"
                            name="savedAddress"
                            checked={selectedAddressId === address.id}
                            disabled={busy}
                            onChange={() => {
                              setSelectedAddressId(address.id);
                              setShipping(
                                addressFromSaved(
                                  address,
                                  shipping.email || customerEmail || "",
                                ),
                              );
                              setFieldErrors({});
                              setShippingRateId(null);
                            }}
                          />
                          <span>
                            {address.firstName} {address.lastName}
                            <br />
                            {address.line1}
                            {address.line2 ? `, ${address.line2}` : ""}
                            <br />
                            {address.postalCode} {address.city},{" "}
                            {address.country}
                          </span>
                        </label>
                      );
                    })}
                    <label
                      className="checkout-saved__option"
                      htmlFor={`${baseId}-addr-new`}
                    >
                      <input
                        id={`${baseId}-addr-new`}
                        type="radio"
                        name="savedAddress"
                        checked={selectedAddressId === "new"}
                        disabled={busy}
                        onChange={() => {
                          setSelectedAddressId("new");
                          setShipping((s) => ({
                            ...emptyShippingForm(
                              (s.country as (typeof CHECKOUT_COUNTRIES)[number]) ||
                                "DE",
                            ),
                            email: s.email,
                          }));
                        }}
                      />
                      <span>{labels.newAddress}</span>
                    </label>
                  </fieldset>
                ) : null}

                {selectedAddressId === "new" || savedAddresses.length === 0
                  ? renderAddressFields(
                      shipping,
                      fieldErrors,
                      fieldIds,
                      errorIds,
                      updateField,
                      onBlurField,
                      false,
                    )
                  : null}

                {error ? (
                  <p className="checkout-page__error" role="alert">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  className="btn btn--primary account-form__submit"
                  disabled={busy}
                >
                  {labels.continue}
                </button>
              </form>
            </>
          ) : null}

          {step === "shipping" ? (
            <form
              className="checkout-form account-form"
              noValidate
              onSubmit={onContinueShipping}
            >
              <h2 className="checkout-form__title">{labels.shippingMethod}</h2>
              <fieldset className="checkout-rates">
                <legend className="visually-hidden">
                  {labels.shippingMethod}
                </legend>
                {(quote?.shippingRates ?? []).map((rate) => {
                  const inputId = `${baseId}-rate-${rate.id}`;
                  return (
                    <label
                      key={rate.id}
                      className="checkout-rates__option"
                      htmlFor={inputId}
                    >
                      <input
                        id={inputId}
                        type="radio"
                        name="shippingRate"
                        checked={shippingRateId === rate.id}
                        disabled={busy}
                        onChange={() => {
                          setShippingRateId(rate.id);
                          void fetchQuote(shipping.country, rate.id);
                        }}
                      />
                      <span className="checkout-rates__name">
                        {rate.displayName}
                      </span>
                      <span className="checkout-rates__price">
                        {rate.amount === 0
                          ? labels.freeShipping
                          : formatMoney(rate.amount, locale, currency)}
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              {error ? (
                <p className="checkout-page__error" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="checkout-form__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={busy}
                  onClick={() => goToStep("information")}
                >
                  {labels.returnTo} {labels.contact}
                </button>
                <button
                  type="submit"
                  className="btn btn--primary account-form__submit"
                  disabled={busy || !shippingRateId}
                >
                  {labels.continue}
                </button>
              </div>
            </form>
          ) : null}

          {step === "payment" ? (
            <form
              className="checkout-form account-form"
              noValidate
              onSubmit={onPay}
            >
              <h2 className="checkout-form__title">{labels.payment}</h2>

              {stripePublishableKey && quote ? (
                <PaymentCheckout
                  key={`${quote.total}-${shippingRateId ?? "none"}`}
                  ref={paymentRef}
                  publishableKey={stripePublishableKey}
                  locale={locale}
                  amount={quote.total}
                  unavailableMessage={labels.paymentUnavailable}
                />
              ) : !stripePublishableKey ? (
                <p className="checkout-page__status" role="status">
                  {labels.secureNote}
                </p>
              ) : (
                <p className="checkout-page__status" role="status">
                  {labels.paymentUnavailable}
                </p>
              )}

              <label
                className="checkout-form__terms"
                htmlFor={`${baseId}-billing-diff`}
              >
                <input
                  id={`${baseId}-billing-diff`}
                  type="checkbox"
                  checked={billingDifferent}
                  disabled={busy}
                  onChange={(e) => {
                    setBillingDifferent(e.target.checked);
                    if (e.target.checked) {
                      setBilling({ ...shipping, email: shipping.email });
                    }
                  }}
                />
                <span>{labels.billingDifferent}</span>
              </label>

              {billingDifferent ? (
                <div className="checkout-billing">
                  <h3 className="checkout-form__subtitle">
                    {labels.billingAddress}
                  </h3>
                  {renderAddressFields(
                    billing,
                    billingErrors,
                    billingFieldIds,
                    billingErrorIds,
                    updateBillingField,
                    onBlurBillingField,
                    false,
                  )}
                </div>
              ) : null}

              <label className="checkout-form__terms" htmlFor={termsPayId}>
                <input
                  id={termsPayId}
                  type="checkbox"
                  checked={acceptTerms}
                  disabled={busy}
                  onChange={(e) => {
                    setAcceptTerms(e.target.checked);
                    if (e.target.checked && error === labels.termsRequired) {
                      setError(null);
                    }
                  }}
                />
                <span>{labels.acceptTerms}</span>
              </label>

              {error ? (
                <p className="checkout-page__error" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="btn btn--primary account-form__submit"
                disabled={busy || !quote || !shippingRateId}
              >
                {labels.payObligation}
              </button>
              <p className="checkout-form__note">{labels.secureNote}</p>

              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
                onClick={() => goToStep("shipping")}
              >
                {labels.returnTo} {labels.shippingMethod}
              </button>
            </form>
          ) : null}
        </div>

        {summary}
      </div>
    </div>
  );
}
