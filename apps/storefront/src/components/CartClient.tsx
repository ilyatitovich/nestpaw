import { useEffect, useId, useState } from "react";
import { localizePath } from "@/i18n/ui";
import {
  applyCartDiscount,
  type Cart,
  fetchCart,
  lineTitle,
  lineVariantLabel,
  patchCartLine,
} from "@/lib/cart";
import { setCustomerAccessToken } from "@/lib/customer-auth";

type Props = {
  apiUrl: string;
  locale: string;
  shopHref: string;
  checkoutHref: string;
  labels: {
    empty: string;
    continueShopping: string;
    proceedToCheckout: string;
    discount: string;
    apply: string;
    remove: string;
    freeShipProgress: string;
    freeShipUnlocked: string;
    subtotal: string;
    discountLabel: string;
    total: string;
    qty: string;
    decreaseQty: string;
    increaseQty: string;
    taxesNote: string;
    discountInvalid: string;
    loadError: string;
    updateError: string;
  };
};

const FREE_SHIP_THRESHOLD = 4900;

function formatMoney(cents: number, locale: string, currency = "EUR") {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-IE", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export default function CartClient({
  apiUrl,
  locale,
  shopHref,
  checkoutHref,
  labels,
}: Props) {
  const discountId = useId();
  const [cart, setCart] = useState<Cart | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only cart load + session restore
  useEffect(() => {
    fetchCart(apiUrl)
      .then((data) => {
        setCart(data);
        if (data.discountCode) setCode(data.discountCode);
      })
      .catch(() => setError(labels.loadError));
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

  async function applyDiscount() {
    if (!cart) return;
    setBusy(true);
    setError(null);
    try {
      const next = await applyCartDiscount(apiUrl, cart.token, code.trim());
      setCart(next);
      if (next.discountCode) setCode(next.discountCode);
    } catch {
      setError(labels.discountInvalid);
    } finally {
      setBusy(false);
    }
  }

  async function setLineQuantity(lineId: string, quantity: number) {
    if (!cart) return;
    setBusy(true);
    setError(null);
    try {
      setCart(await patchCartLine(apiUrl, cart.token, lineId, quantity));
    } catch {
      setError(labels.updateError);
    } finally {
      setBusy(false);
    }
  }

  if (!cart) {
    return (
      <p className="cart-page__status" role="status">
        {error ?? "…"}
      </p>
    );
  }

  if (!cart.lines.length) {
    return (
      <div className="cart-page__empty">
        <p className="cart-page__empty-copy">{labels.empty}</p>
        <a className="btn btn--primary" href={shopHref}>
          {labels.continueShopping}
        </a>
      </div>
    );
  }

  const currency = cart.totals.currency || "EUR";
  const remaining = Math.max(0, FREE_SHIP_THRESHOLD - cart.totals.subtotal);
  const freeShipProgress = Math.min(
    100,
    Math.round((cart.totals.subtotal / FREE_SHIP_THRESHOLD) * 100),
  );
  const freeShipMsg =
    remaining === 0
      ? labels.freeShipUnlocked
      : labels.freeShipProgress.replace(
          "{amount}",
          (remaining / 100).toFixed(2),
        );

  return (
    <div className="cart-page">
      <div
        className={
          remaining === 0
            ? "cart-page__freeship is-unlocked"
            : "cart-page__freeship"
        }
      >
        <p className="cart-page__freeship-copy">{freeShipMsg}</p>
        <div
          className="cart-page__freeship-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={freeShipProgress}
          aria-label={freeShipMsg}
        >
          <span
            className="cart-page__freeship-fill"
            style={{ width: `${freeShipProgress}%` }}
          />
        </div>
      </div>

      <div className="cart-page__layout">
        <div className="cart-page__lines">
          {cart.lines.map((line) => {
            const title = lineTitle(line, locale);
            const variant = lineVariantLabel(line);
            const media = line.variant.product.media?.[0];
            const slug = line.variant.product.translations.find(
              (t) => t.locale === locale,
            )?.slug;
            const href = slug ? localizePath(locale, `/products/${slug}`) : undefined;

            return (
              <article className="cart-line" key={line.id}>
                <div className="cart-line__media" aria-hidden={!media}>
                  {media ? (
                    <img src={media.url} alt={media.alt || title} />
                  ) : null}
                </div>

                <div className="cart-line__body">
                  <div className="cart-line__header">
                    <div className="cart-line__info">
                      {href ? (
                        <a className="cart-line__title" href={href}>
                          {title}
                        </a>
                      ) : (
                        <h2 className="cart-line__title">{title}</h2>
                      )}
                      {variant ? (
                        <p className="cart-line__variant">{variant}</p>
                      ) : null}
                    </div>
                    <p className="cart-line__price">
                      {formatMoney(
                        line.variant.price * line.quantity,
                        locale,
                        currency,
                      )}
                    </p>
                  </div>

                  <div className="cart-line__controls">
                    <div
                      className="cart-line__qty pdp-qty"
                      role="group"
                      aria-label={labels.qty}
                    >
                      <button
                        type="button"
                        className="pdp-qty__btn"
                        disabled={busy || line.quantity <= 1}
                        aria-label={labels.decreaseQty}
                        onClick={() =>
                          void setLineQuantity(line.id, line.quantity - 1)
                        }
                      >
                        −
                      </button>
                      <input
                        className="pdp-qty__input"
                        type="number"
                        min={1}
                        max={99}
                        value={line.quantity}
                        disabled={busy}
                        aria-label={labels.qty}
                        onChange={(ev) => {
                          const qty = Number(ev.target.value);
                          if (Number.isFinite(qty) && qty >= 1) {
                            void setLineQuantity(line.id, qty);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="pdp-qty__btn"
                        disabled={busy || line.quantity >= 99}
                        aria-label={labels.increaseQty}
                        onClick={() =>
                          void setLineQuantity(line.id, line.quantity + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="cart-line__remove"
                      disabled={busy}
                      onClick={() => void setLineQuantity(line.id, 0)}
                    >
                      {labels.remove}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="cart-summary">
          <h2 className="cart-summary__title">{labels.total}</h2>
          <dl className="cart-summary__rows">
            <div className="cart-summary__row">
              <dt>{labels.subtotal}</dt>
              <dd>{formatMoney(cart.totals.subtotal, locale, currency)}</dd>
            </div>
            {cart.totals.discountTotal > 0 ? (
              <div className="cart-summary__row">
                <dt>
                  {labels.discountLabel}
                  {cart.discountCode ? (
                    <span className="cart-summary__code">
                      {cart.discountCode}
                    </span>
                  ) : null}
                </dt>
                <dd>
                  −{formatMoney(cart.totals.discountTotal, locale, currency)}
                </dd>
              </div>
            ) : null}
            <div className="cart-summary__row cart-summary__row--total">
              <dt>{labels.total}</dt>
              <dd>{formatMoney(cart.totals.total, locale, currency)}</dd>
            </div>
          </dl>

          <p className="cart-summary__taxes">{labels.taxesNote}</p>

          <form
            className="cart-summary__discount"
            onSubmit={(event) => {
              event.preventDefault();
              void applyDiscount();
            }}
          >
            <label className="visually-hidden" htmlFor={discountId}>
              {labels.discount}
            </label>
            <input
              id={discountId}
              className="cart-summary__discount-input"
              name="discount"
              autoComplete="off"
              placeholder={labels.discount}
              value={code}
              disabled={busy}
              onChange={(e) => setCode(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn--ghost cart-summary__discount-btn"
              disabled={busy || !code.trim()}
            >
              {labels.apply}
            </button>
          </form>

          {error ? (
            <p className="cart-page__error" role="alert">
              {error}
            </p>
          ) : null}

          <a
            className="btn btn--primary cart-summary__checkout"
            href={checkoutHref}
          >
            {labels.proceedToCheckout}
          </a>
          <a className="cart-summary__continue" href={shopHref}>
            {labels.continueShopping}
          </a>
        </aside>
      </div>
    </div>
  );
}
