import { useEffect, useState } from "react";
import { setCustomerAccessToken } from "../lib/customer-auth";

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
  const [cart, setCart] = useState<Cart | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const token = localStorage.getItem("cart_token");
    const res = await fetch(`${apiUrl}/cart`, {
      headers: token ? { "X-Cart-Token": token } : {},
    });
    const data = (await res.json()) as Cart;
    const header = res.headers.get("X-Cart-Token");
    if (header) localStorage.setItem("cart_token", header);
    else localStorage.setItem("cart_token", data.token);
    setCart(data);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only cart load + session restore
  useEffect(() => {
    load().catch(() => setError(labels.loadError));
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
      const res = await fetch(`${apiUrl}/cart/discount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Cart-Token": cart.token,
        },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) throw new Error(labels.discountInvalid);
      setCart((await res.json()) as Cart);
    } catch (e) {
      setError(e instanceof Error ? e.message : labels.discountInvalid);
    } finally {
      setBusy(false);
    }
  }

  async function setLineQuantity(lineId: string, quantity: number) {
    if (!cart) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/cart/items/${lineId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Cart-Token": cart.token,
        },
        body: JSON.stringify({ quantity }),
      });
      if (!res.ok) throw new Error(labels.updateError);
      setCart((await res.json()) as Cart);
    } catch (e) {
      setError(e instanceof Error ? e.message : labels.updateError);
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
        <p>{labels.empty}</p>
        <a className="btn btn--primary" href={shopHref}>
          {labels.continueShopping}
        </a>
      </div>
    );
  }

  const currency = cart.totals.currency || "EUR";
  const remaining = Math.max(0, FREE_SHIP_THRESHOLD - cart.totals.subtotal);
  const freeShipMsg =
    remaining === 0
      ? labels.freeShipUnlocked
      : labels.freeShipProgress.replace(
          "{amount}",
          (remaining / 100).toFixed(2),
        );

  return (
    <div className="cart-page">
      <p className="cart-page__freeship">{freeShipMsg}</p>

      <div className="cart-page__layout">
        <div className="cart-page__lines">
          {cart.lines.map((line) => {
            const title =
              line.variant.product.translations.find((t) => t.locale === locale)
                ?.title ??
              line.variant.product.translations[0]?.title ??
              "Item";
            return (
              <article className="cart-line" key={line.id}>
                <div className="cart-line__main">
                  <h2 className="cart-line__title">{title}</h2>
                  <div className="cart-line__controls">
                    <label className="cart-line__qty">
                      <span>{labels.qty}</span>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={line.quantity}
                        disabled={busy}
                        onChange={(ev) => {
                          const qty = Number(ev.target.value);
                          if (Number.isFinite(qty) && qty >= 1) {
                            void setLineQuantity(line.id, qty);
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={busy}
                      onClick={() => void setLineQuantity(line.id, 0)}
                    >
                      {labels.remove}
                    </button>
                  </div>
                </div>
                <p className="cart-line__price">
                  {formatMoney(
                    line.variant.price * line.quantity,
                    locale,
                    currency,
                  )}
                </p>
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
                <dt>{labels.discountLabel}</dt>
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

          <form
            className="cart-summary__discount"
            onSubmit={(event) => {
              event.preventDefault();
              void applyDiscount();
            }}
          >
            <label className="visually-hidden" htmlFor="cart-discount">
              {labels.discount}
            </label>
            <input
              id="cart-discount"
              name="discount"
              autoComplete="off"
              placeholder={labels.discount}
              value={code}
              disabled={busy}
              onChange={(e) => setCode(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn--ghost"
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

          <a className="btn btn--primary cart-summary__checkout" href={checkoutHref}>
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
