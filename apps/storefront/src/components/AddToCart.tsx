import { useState } from "react";

type Props = {
  apiUrl: string;
  variantId: string;
  label: string;
  locale: string;
};

export default function AddToCart({ apiUrl, variantId, label, locale }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );

  async function add() {
    setStatus("loading");
    try {
      const token = localStorage.getItem("cart_token");
      const res = await fetch(`${apiUrl}/cart/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Cart-Token": token } : {}),
        },
        body: JSON.stringify({ variantId, quantity: 1 }),
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
          payload: { variantId },
          locale,
        }),
      }).catch(() => undefined);

      setStatus("done");
      window.location.href = `/${locale}/cart`;
    } catch {
      setStatus("error");
    }
  }

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <button
        type="button"
        className="btn btn--primary"
        onClick={add}
        disabled={status === "loading"}
      >
        {status === "loading" ? "…" : label}
      </button>
      {status === "error" ? (
        <p style={{ color: "#b42318" }}>Could not add to cart</p>
      ) : null}
    </div>
  );
}
