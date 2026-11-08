import { useId, useMemo, useState } from "react";
import {
  CART_TOKEN_KEY,
  type Cart,
  dispatchCartOpen,
  dispatchCartUpdated,
  persistCartToken,
} from "@/lib/cart";

type Variant = {
  id: string;
  price: number;
  compareAtPrice?: number | null;
  option1?: string | null;
  inventory?: { quantity: number } | null;
};

type Props = {
  apiUrl: string;
  variants: Variant[];
  label: string;
  locale: string;
  option1Name?: string | null;
  description?: string;
  qtyLabel: string;
  decreaseLabel: string;
  increaseLabel: string;
  inStockLabel: string;
  outOfStockLabel: string;
  errorLabel: string;
};

function formatPrice(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}

export default function AddToCart({
  apiUrl,
  variants,
  label,
  locale,
  option1Name,
  description,
  qtyLabel,
  decreaseLabel,
  increaseLabel,
  inStockLabel,
  outOfStockLabel,
  errorLabel,
}: Props) {
  const baseId = useId();
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );

  const selected = useMemo(
    () => variants.find((v) => v.id === variantId) ?? variants[0],
    [variants, variantId],
  );

  const stock = selected?.inventory?.quantity ?? 0;
  const inStock = stock > 0;
  const compareAt =
    selected?.compareAtPrice && selected.compareAtPrice > selected.price
      ? selected.compareAtPrice
      : null;
  const maxQty = Math.max(1, stock || 1);

  async function add() {
    if (!selected || !inStock) return;
    setStatus("loading");
    try {
      const token = localStorage.getItem(CART_TOKEN_KEY);
      const res = await fetch(`${apiUrl}/cart/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Cart-Token": token } : {}),
        },
        body: JSON.stringify({ variantId: selected.id, quantity: qty }),
      });
      if (!res.ok) throw new Error("failed");
      const cart = (await res.json()) as Cart;
      persistCartToken(res, cart);

      await fetch(`${apiUrl}/analytics/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "add_to_cart",
          payload: { variantId: selected.id, quantity: qty },
          locale,
        }),
      }).catch(() => undefined);

      setStatus("done");
      dispatchCartUpdated();
      dispatchCartOpen();
      window.setTimeout(() => setStatus("idle"), 900);
    } catch {
      setStatus("error");
    }
  }

  if (!selected) return null;

  return (
    <div className="pdp-buy">
      {variants.length > 1 ? (
        <fieldset className="pdp-buy__options">
          <legend className="pdp-buy__legend">
            {option1Name || "Option"}:
          </legend>
          <div className="pdp-buy__pills" role="presentation">
            {variants.map((v) => {
              const active = v.id === selected.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={active}
                  className={`pdp-buy__pill${active ? " is-active" : ""}`}
                  onClick={() => {
                    setVariantId(v.id);
                    setQty(1);
                  }}
                >
                  {v.option1 || v.id}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="pdp-buy__price-row">
        <span className="pdp-buy__price">{formatPrice(selected.price)}</span>
        {compareAt ? (
          <span className="pdp-buy__compare">{formatPrice(compareAt)}</span>
        ) : null}
      </div>

      <p
        className={`pdp-buy__stock${inStock ? "" : " is-out"}`}
        data-icon="store"
      >
        {inStock ? inStockLabel : outOfStockLabel}
      </p>

      {description ? <p className="pdp__desc">{description}</p> : null}

      <div className="pdp-buy__actions">
        <div className="pdp-qty">
          <label className="visually-hidden" htmlFor={`${baseId}-qty`}>
            {qtyLabel}
          </label>
          <button
            type="button"
            className="pdp-qty__btn"
            aria-label={decreaseLabel}
            disabled={qty <= 1}
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            −
          </button>
          <input
            id={`${baseId}-qty`}
            className="pdp-qty__input"
            type="number"
            inputMode="numeric"
            min={1}
            max={maxQty}
            value={qty}
            onChange={(e) => {
              const next = Number.parseInt(e.target.value, 10);
              if (Number.isNaN(next)) {
                setQty(1);
                return;
              }
              setQty(Math.min(maxQty, Math.max(1, next)));
            }}
          />
          <button
            type="button"
            className="pdp-qty__btn"
            aria-label={increaseLabel}
            disabled={qty >= maxQty || !inStock}
            onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
          >
            +
          </button>
        </div>

        <button
          type="button"
          className={`btn btn--primary pdp-buy__cta${status === "done" ? " btn--added" : ""}`}
          onClick={add}
          disabled={!inStock || status === "loading" || status === "done"}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            width="1.1em"
            height="1.1em"
          >
            <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.6L20 8H7" />
            <circle cx="10" cy="20" r="1.2" />
            <circle cx="17" cy="20" r="1.2" />
          </svg>
          {status === "loading" ? "…" : status === "done" ? "✓" : label}
        </button>
      </div>

      {status === "error" ? (
        <p className="pdp-buy__error">{errorLabel}</p>
      ) : null}
    </div>
  );
}
