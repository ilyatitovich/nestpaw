import { useMemo, useState } from "react";

type Variant = {
  id: string;
  price: number;
  option1?: string | null;
  inventory?: { quantity: number } | null;
};

type Props = {
  apiUrl: string;
  variants: Variant[];
  label: string;
  locale: string;
  option1Name?: string | null;
};

export default function AddToCart({
  apiUrl,
  variants,
  label,
  locale,
  option1Name,
}: Props) {
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );

  const selected = useMemo(
    () => variants.find((v) => v.id === variantId) ?? variants[0],
    [variants, variantId],
  );

  async function add() {
    if (!selected) return;
    setStatus("loading");
    try {
      const token = localStorage.getItem("cart_token");
      const res = await fetch(`${apiUrl}/cart/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Cart-Token": token } : {}),
        },
        body: JSON.stringify({ variantId: selected.id, quantity: 1 }),
      });
      if (!res.ok) throw new Error("failed");
      const cart = (await res.json()) as { token: string };
      localStorage.setItem("cart_token", cart.token);
      const headerToken = res.headers.get("X-Cart-Token");
      if (headerToken) localStorage.setItem("cart_token", headerToken);

      await fetch(`${apiUrl}/analytics/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "add_to_cart",
          payload: { variantId: selected.id },
          locale,
        }),
      }).catch(() => undefined);

      setStatus("done");
      window.setTimeout(() => {
        window.location.href = `/${locale}/cart`;
      }, 280);
    } catch {
      setStatus("error");
    }
  }

  if (!selected) return null;

  return (
    <div style={{ marginTop: "1.5rem", display: "grid", gap: "0.75rem" }}>
      {variants.length > 1 ? (
        <label style={{ display: "grid", gap: "0.35rem" }}>
          {option1Name || "Option"}
          <select
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.option1 || v.id} — €{(v.price / 100).toFixed(2)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <p style={{ margin: 0, fontSize: "1.25rem" }}>
        €{(selected.price / 100).toFixed(2)}
      </p>
      <button
        type="button"
        className={`btn btn--primary${status === "done" ? " btn--added" : ""}`}
        onClick={add}
        disabled={status === "loading" || status === "done"}
      >
        {status === "loading" ? "…" : status === "done" ? "✓" : label}
      </button>
      {status === "error" ? (
        <p style={{ color: "#b42318" }}>Could not add to cart</p>
      ) : null}
    </div>
  );
}
