import { useEffect, useId, useState } from "react";
import { localizePath } from "../i18n/ui";
import FieldError from "./account/FieldError";
import {
  getCustomerAccessToken,
  setCustomerAccessToken,
} from "../lib/customer-auth";
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
} from "../lib/checkout-validation";

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

type Props = {
  apiUrl: string;
  locale: string;
  storeUrl: string;
  cartHref: string;
  labels: {
    shipping: string;
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

export default function CheckoutClient({
  apiUrl,
  locale,
  storeUrl,
  cartHref,
  labels,
}: Props) {
  const baseId = useId();
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

  const [cart, setCart] = useState<Cart | null>(null);
  const [shipping, setShipping] = useState<CheckoutShippingForm>(
    emptyShippingForm(),
  );
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [quote, setQuote] = useState<{
    shippingTotal: number;
    taxTotal: number;
    total: number;
    freeShipping: boolean;
  } | null>(null);

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
    void fetch(`${apiUrl}/customers/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { accessToken?: string };
        if (data.accessToken) setCustomerAccessToken(data.accessToken);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!cart?.token || !shipping.country) return;
    const token = cart.token;
    const country = shipping.country;
    const timer = window.setTimeout(() => {
      void fetch(
        `${apiUrl}/checkout/quote?country=${encodeURIComponent(country)}`,
        { headers: { "X-Cart-Token": token } },
      )
        .then(async (res) => {
          if (!res.ok) return;
          const data = (await res.json()) as {
            shippingTotal: number;
            taxTotal: number;
            total: number;
            freeShipping: boolean;
          };
          setQuote(data);
        })
        .catch(() => undefined);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [apiUrl, cart?.token, shipping.country]);

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

  function focusFirstError(errors: CheckoutFieldErrors) {
    const field = firstCheckoutErrorField(errors);
    if (!field) return;
    focusField(fieldIds[field]);
  }

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart || submitting) return;

    const result = validateCheckoutForm(shipping, validationLabels);
    if (!result.ok) {
      setFieldErrors(result.errors);
      setError(null);
      focusFirstError(result.errors);
      return;
    }
    if (!acceptTerms) {
      setError(labels.termsRequired);
      return;
    }

    setSubmitting(true);
    setBusy(true);
    setError(null);
    try {
      await fetch(`${apiUrl}/analytics/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "begin_checkout", payload: {}, locale }),
      }).catch(() => undefined);

      const customerToken = getCustomerAccessToken();
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
          locale,
          currency: "EUR",
          acceptTerms: true,
          successUrl: `${storeUrl}${localizePath(locale, "/checkout/success")}`,
          cancelUrl: `${storeUrl}${localizePath(locale, "/checkout")}`,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? labels.errorGeneric);
      }
      const data = (await res.json()) as { checkoutUrl: string };
      window.location.href = data.checkoutUrl;
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

  return (
    <div className="checkout-page">
      <div className="checkout-page__layout">
        <form
          className="checkout-form account-form"
          noValidate
          onSubmit={onSubmit}
        >
          <h2 className="checkout-form__title">{labels.shipping}</h2>

          <div className="checkout-form__row">
            <div className="account-field">
              <label htmlFor={fieldIds.firstName}>{labels.firstName}</label>
              <input
                id={fieldIds.firstName}
                name="firstName"
                autoComplete="given-name"
                value={shipping.firstName}
                disabled={busy}
                aria-invalid={Boolean(fieldErrors.firstName) || undefined}
                aria-describedby={
                  fieldErrors.firstName ? errorIds.firstName : undefined
                }
                onChange={(e) => updateField("firstName", e.target.value)}
                onBlur={() => onBlurField("firstName")}
              />
              <FieldError
                id={errorIds.firstName}
                message={fieldErrors.firstName}
              />
            </div>
            <div className="account-field">
              <label htmlFor={fieldIds.lastName}>{labels.lastName}</label>
              <input
                id={fieldIds.lastName}
                name="lastName"
                autoComplete="family-name"
                value={shipping.lastName}
                disabled={busy}
                aria-invalid={Boolean(fieldErrors.lastName) || undefined}
                aria-describedby={
                  fieldErrors.lastName ? errorIds.lastName : undefined
                }
                onChange={(e) => updateField("lastName", e.target.value)}
                onBlur={() => onBlurField("lastName")}
              />
              <FieldError
                id={errorIds.lastName}
                message={fieldErrors.lastName}
              />
            </div>
          </div>

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
              aria-describedby={fieldErrors.email ? errorIds.email : undefined}
              onChange={(e) => updateField("email", e.target.value)}
              onBlur={() => onBlurField("email")}
            />
            <FieldError id={errorIds.email} message={fieldErrors.email} />
          </div>

          <div className="account-field">
            <label htmlFor={fieldIds.line1}>{labels.line1}</label>
            <input
              id={fieldIds.line1}
              name="line1"
              autoComplete="address-line1"
              value={shipping.line1}
              disabled={busy}
              aria-invalid={Boolean(fieldErrors.line1) || undefined}
              aria-describedby={fieldErrors.line1 ? errorIds.line1 : undefined}
              onChange={(e) => updateField("line1", e.target.value)}
              onBlur={() => onBlurField("line1")}
            />
            <FieldError id={errorIds.line1} message={fieldErrors.line1} />
          </div>

          <div className="account-field">
            <label htmlFor={fieldIds.line2}>{labels.line2}</label>
            <input
              id={fieldIds.line2}
              name="line2"
              autoComplete="address-line2"
              value={shipping.line2}
              disabled={busy}
              aria-invalid={Boolean(fieldErrors.line2) || undefined}
              aria-describedby={fieldErrors.line2 ? errorIds.line2 : undefined}
              onChange={(e) => updateField("line2", e.target.value)}
              onBlur={() => onBlurField("line2")}
            />
            <FieldError id={errorIds.line2} message={fieldErrors.line2} />
          </div>

          <div className="checkout-form__row">
            <div className="account-field">
              <label htmlFor={fieldIds.city}>{labels.city}</label>
              <input
                id={fieldIds.city}
                name="city"
                autoComplete="address-level2"
                value={shipping.city}
                disabled={busy}
                aria-invalid={Boolean(fieldErrors.city) || undefined}
                aria-describedby={fieldErrors.city ? errorIds.city : undefined}
                onChange={(e) => updateField("city", e.target.value)}
                onBlur={() => onBlurField("city")}
              />
              <FieldError id={errorIds.city} message={fieldErrors.city} />
            </div>
            <div className="account-field">
              <label htmlFor={fieldIds.postalCode}>{labels.postalCode}</label>
              <input
                id={fieldIds.postalCode}
                name="postalCode"
                autoComplete="postal-code"
                value={shipping.postalCode}
                disabled={busy}
                aria-invalid={Boolean(fieldErrors.postalCode) || undefined}
                aria-describedby={
                  fieldErrors.postalCode ? errorIds.postalCode : undefined
                }
                onChange={(e) => updateField("postalCode", e.target.value)}
                onBlur={() => onBlurField("postalCode")}
              />
              <FieldError
                id={errorIds.postalCode}
                message={fieldErrors.postalCode}
              />
            </div>
          </div>

          <div className="checkout-form__row">
            <div className="account-field">
              <label htmlFor={fieldIds.country}>{labels.country}</label>
              <select
                id={fieldIds.country}
                name="country"
                autoComplete="country"
                value={shipping.country}
                disabled={busy}
                aria-invalid={Boolean(fieldErrors.country) || undefined}
                aria-describedby={
                  fieldErrors.country ? errorIds.country : undefined
                }
                onChange={(e) => updateField("country", e.target.value)}
                onBlur={() => onBlurField("country")}
              >
                {CHECKOUT_COUNTRIES.map((code) => (
                  <option key={code} value={code}>
                    {countryLabels[code]}
                  </option>
                ))}
              </select>
              <FieldError id={errorIds.country} message={fieldErrors.country} />
            </div>
            <div className="account-field">
              <label htmlFor={fieldIds.phone}>{labels.phone}</label>
              <input
                id={fieldIds.phone}
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={shipping.phone}
                disabled={busy}
                aria-invalid={Boolean(fieldErrors.phone) || undefined}
                aria-describedby={fieldErrors.phone ? errorIds.phone : undefined}
                onChange={(e) => updateField("phone", e.target.value)}
                onBlur={() => onBlurField("phone")}
              />
              <FieldError id={errorIds.phone} message={fieldErrors.phone} />
            </div>
          </div>

          <label className="checkout-form__terms">
            <input
              type="checkbox"
              checked={acceptTerms}
              disabled={busy}
              onChange={(e) => setAcceptTerms(e.target.checked)}
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
            disabled={busy}
          >
            {labels.payObligation}
          </button>
          <p className="checkout-form__note">{labels.secureNote}</p>
        </form>

        <aside className="checkout-summary">
          <div className="checkout-summary__sticky">
            <h2 className="checkout-summary__title">{labels.orderSummary}</h2>
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
                    {quote.freeShipping
                      ? formatMoney(0, locale, currency)
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
        </aside>
      </div>
    </div>
  );
}
