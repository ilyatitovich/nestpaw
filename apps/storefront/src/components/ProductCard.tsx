import { useEffect, useState } from "react";
import {
  CART_TOKEN_KEY,
  type Cart,
  dispatchCartOpen,
  dispatchCartUpdated,
  persistCartToken,
} from "@/lib/cart";
import { readWishlistIds, toggleWishlistId } from "@/lib/wishlist";

export type ProductCardVariant = {
  id: string;
  price: number;
  compareAtPrice?: number | null;
  option1?: string | null;
};

export type ProductCardProduct = {
  id: string;
  translations: { locale: string; title: string; slug: string }[];
  media: { url: string; alt: string }[];
  variants: ProductCardVariant[];
};

type Labels = {
  from: string;
  sale: string;
  add: string;
  wishlist: string;
  wishlistAdded: string;
  addError: string;
};

type Props = {
  product: ProductCardProduct;
  locale: string;
  apiUrl: string;
  labels: Labels;
  href: string;
  heading?: "h2" | "h3";
  onWishlistChange?: (productId: string, saved: boolean) => void;
};

function formatEuro(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}

function cheapestVariant(variants: ProductCardVariant[]) {
  if (!variants.length) return null;
  return variants.reduce((best, v) => (v.price < best.price ? v : best));
}

function HeartIcon({ filled }: { filled?: boolean }) {
  return (
    <svg
      className="product-card__wishlist-icon"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function BagIcon() {
  return (
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
  );
}

export default function ProductCard({
  product,
  locale,
  apiUrl,
  labels,
  href,
  heading = "h2",
  onWishlistChange,
}: Props) {
  const tr =
    product.translations.find((x) => x.locale === locale) ??
    product.translations[0];
  const img = product.media[0];
  const variant = cheapestVariant(product.variants);
  const saleVariant = product.variants.find(
    (v) =>
      v.compareAtPrice != null &&
      v.compareAtPrice > 0 &&
      v.compareAtPrice > v.price,
  );

  const [wishSaved, setWishSaved] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );

  useEffect(() => {
    setWishSaved(readWishlistIds().includes(product.id));
  }, [product.id]);

  async function addToCart() {
    if (!variant) return;
    setStatus("loading");
    try {
      const token = localStorage.getItem(CART_TOKEN_KEY);
      const res = await fetch(`${apiUrl}/cart/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Cart-Token": token } : {}),
        },
        body: JSON.stringify({ variantId: variant.id, quantity: 1 }),
      });
      if (!res.ok) throw new Error("failed");
      const cart = (await res.json()) as Cart;
      persistCartToken(res, cart);

      await fetch(`${apiUrl}/analytics/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "add_to_cart",
          payload: { variantId: variant.id, quantity: 1 },
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

  const HeadingTag = heading;
  const price = variant?.price ?? 0;
  const compareAt =
    variant?.compareAtPrice && variant.compareAtPrice > variant.price
      ? variant.compareAtPrice
      : saleVariant?.compareAtPrice &&
          saleVariant.compareAtPrice > saleVariant.price
        ? saleVariant.compareAtPrice
        : null;

  return (
    <article className="product-card">
      <div className="product-card__media">
        {saleVariant ? (
          <span className="product-card__badge">{labels.sale}</span>
        ) : null}
        {img ? (
          <img src={img.url} alt={img.alt || tr?.title || ""} loading="lazy" />
        ) : null}
        <button
          type="button"
          className="product-card__wishlist"
          aria-pressed={wishSaved}
          aria-label={wishSaved ? labels.wishlistAdded : labels.wishlist}
          onClick={() => {
            const saved = toggleWishlistId(product.id);
            setWishSaved(saved);
            onWishlistChange?.(product.id, saved);
          }}
        >
          <HeartIcon filled={wishSaved} />
        </button>
      </div>

      <HeadingTag className="product-card__title">
        <a className="product-card__link" href={href}>
          {tr?.title}
        </a>
      </HeadingTag>

      <p className="product-card__price">
        {labels.from} {formatEuro(price)}
        {compareAt ? (
          <s className="product-card__compare">{formatEuro(compareAt)}</s>
        ) : null}
      </p>

      <footer className="product-card__actions">
        <button
          type="button"
          className={`btn btn--primary product-card__add${status === "done" ? " btn--added" : ""}`}
          onClick={addToCart}
          disabled={!variant || status === "loading" || status === "done"}
        >
          <BagIcon />
          {status === "loading" ? "…" : status === "done" ? "✓" : labels.add}
        </button>
        {status === "error" ? (
          <p className="product-card__error">{labels.addError}</p>
        ) : null}
      </footer>
    </article>
  );
}
