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
  totals: {
    subtotal: number;
    discountTotal: number;
    total: number;
    currency: string;
  };
  discountCode?: string | null;
};

type ShippingForm = {
  firstName: string;
  lastName: string;
  email: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
};

type Props = {
  apiUrl: string;
  locale: string;
  storeUrl: string;
  labels: {
    empty: string;
    checkout: string;
    discount: string;
    apply: string;
    shipping: string;
    remove: string;
    freeShipProgress: string;
    freeShipUnlocked: string;
  };
};

const FREE_SHIP_THRESHOLD = 4900;

const emptyShipping = (): ShippingForm => ({
  firstName: "",
  lastName: "",
  email: "",
  line1: "",
  line2: "",
  city: "",
  postalCode: "",
  country: "DE",
  phone: "",
});

export default function CartClient({
  apiUrl,
  locale,
  storeUrl,
  labels,
}: Props) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shipping, setShipping] = useState<ShippingForm>(emptyShipping);

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

  function updateField<K extends keyof ShippingForm>(
    key: K,
    value: ShippingForm[K],
  ) {
    setShipping((s) => ({ ...s, [key]: value }));
  }

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
      if (!res.ok) throw new Error("Could not update cart");
      setCart((await res.json()) as Cart);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function checkout(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
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
            firstName: shipping.firstName.trim(),
            lastName: shipping.lastName.trim(),
            email: shipping.email.trim(),
            line1: shipping.line1.trim(),
            line2: shipping.line2.trim() || undefined,
            city: shipping.city.trim(),
            postalCode: shipping.postalCode.trim(),
            country: shipping.country.trim().toUpperCase(),
            phone: shipping.phone.trim() || undefined,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusy(false);
    }
  }

  if (!cart) return <p>{error ?? "…"}</p>;
  if (!cart.lines.length) return <p>{labels.empty}</p>;

  const remaining = Math.max(0, FREE_SHIP_THRESHOLD - cart.totals.subtotal);
  const freeShipMsg =
    remaining === 0
      ? labels.freeShipUnlocked
      : labels.freeShipProgress.replace(
          "{amount}",
          (remaining / 100).toFixed(2),
        );

  return (
    <div>
      <p className="cart__freeship">{freeShipMsg}</p>
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
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                  marginTop: "0.35rem",
                }}
              >
                <label>
                  Qty{" "}
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    disabled={busy}
                    style={{ width: "4rem" }}
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
            <div>
              €{((line.variant.price * line.quantity) / 100).toFixed(2)}
            </div>
          </div>
        );
      })}
      <div className="cart__totals">
        <div>Subtotal: €{(cart.totals.subtotal / 100).toFixed(2)}</div>
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
        <button
          type="button"
          className="btn btn--ghost"
          onClick={applyDiscount}
          disabled={busy}
        >
          {labels.apply}
        </button>
      </div>

      <form
        onSubmit={checkout}
        style={{
          display: "grid",
          gap: "0.75rem",
          marginTop: "2rem",
          maxWidth: "28rem",
        }}
      >
        <h2 className="section__title" style={{ fontSize: "1.25rem" }}>
          {labels.shipping}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <input
            required
            placeholder="First name"
            value={shipping.firstName}
            onChange={(e) => updateField("firstName", e.target.value)}
          />
          <input
            required
            placeholder="Last name"
            value={shipping.lastName}
            onChange={(e) => updateField("lastName", e.target.value)}
          />
        </div>
        <input
          required
          type="email"
          placeholder="Email"
          value={shipping.email}
          onChange={(e) => updateField("email", e.target.value)}
        />
        <input
          required
          placeholder="Address"
          value={shipping.line1}
          onChange={(e) => updateField("line1", e.target.value)}
        />
        <input
          placeholder="Address line 2"
          value={shipping.line2}
          onChange={(e) => updateField("line2", e.target.value)}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <input
            required
            placeholder="City"
            value={shipping.city}
            onChange={(e) => updateField("city", e.target.value)}
          />
          <input
            required
            placeholder="Postal code"
            value={shipping.postalCode}
            onChange={(e) => updateField("postalCode", e.target.value)}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <input
            required
            placeholder="Country (ISO)"
            maxLength={2}
            value={shipping.country}
            onChange={(e) => updateField("country", e.target.value)}
          />
          <input
            placeholder="Phone"
            value={shipping.phone}
            onChange={(e) => updateField("phone", e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={busy}
        >
          {labels.checkout}
        </button>
      </form>
      {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
    </div>
  );
}
