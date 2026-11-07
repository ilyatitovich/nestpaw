import { useEffect, useState } from "react";

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
  totals: { subtotal: number; discountTotal: number; total: number; currency: string };
  discountCode?: string | null;
};

type Props = {
  apiUrl: string;
  locale: string;
  storeUrl: string;
  labels: { empty: string; checkout: string; discount: string; apply: string };
};

export default function CartClient({ apiUrl, locale, storeUrl, labels }: Props) {
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

  useEffect(() => {
    load().catch(() => setError("Could not load cart"));
  }, []);

  async function applyDiscount() {
    if (!cart) return;
    setBusy(true);
    try {
      const res = await fetch(`${apiUrl}/cart/discount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Cart-Token": cart.token,
        },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) throw new Error("Invalid code");
      setCart((await res.json()) as Cart);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (!cart) return;
    setBusy(true);
    setError(null);
    try {
      await fetch(`${apiUrl}/analytics/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "begin_checkout", payload: {}, locale }),
      }).catch(() => undefined);

      const res = await fetch(`${apiUrl}/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Cart-Token": cart.token,
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          shippingAddress: {
            firstName: "Guest",
            lastName: "Customer",
            email: "guest@example.com",
            line1: "Musterstraße 1",
            city: "Berlin",
            postalCode: "10115",
            country: "DE",
          },
          locale,
          currency: "EUR",
          successUrl: `${storeUrl}/${locale}/checkout/success`,
          cancelUrl: `${storeUrl}/${locale}/cart`,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? "Checkout failed");
      }
      const data = (await res.json()) as { checkoutUrl: string };
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setBusy(false);
    }
  }

  if (!cart) return <p>{error ?? "…"}</p>;
  if (!cart.lines.length) return <p>{labels.empty}</p>;

  return (
    <div>
      {cart.lines.map((line) => {
        const title =
          line.variant.product.translations.find((t) => t.locale === locale)
            ?.title ??
          line.variant.product.translations[0]?.title ??
          "Item";
        return (
          <div className="cart__line" key={line.id}>
            <div>
              <strong>{title}</strong>
              <div>× {line.quantity}</div>
            </div>
            <div>€{((line.variant.price * line.quantity) / 100).toFixed(2)}</div>
          </div>
        );
      })}
      <div className="cart__totals">
        <div>
          Subtotal: €{(cart.totals.subtotal / 100).toFixed(2)}
        </div>
        {cart.totals.discountTotal > 0 ? (
          <div>Discount: −€{(cart.totals.discountTotal / 100).toFixed(2)}</div>
        ) : null}
        <div>
          <strong>Total: €{(cart.totals.total / 100).toFixed(2)}</strong>
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <input
          placeholder={labels.discount}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button type="button" className="btn btn--ghost" onClick={applyDiscount} disabled={busy}>
          {labels.apply}
        </button>
      </div>
      <div style={{ marginTop: "1.5rem" }}>
        <button type="button" className="btn btn--primary" onClick={checkout} disabled={busy}>
          {labels.checkout}
        </button>
      </div>
      {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
    </div>
  );
}
