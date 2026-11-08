import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addCartItem,
  applyCartDiscount,
  CART_OPEN_EVENT,
  CART_UPDATED_EVENT,
  type Cart,
  dispatchCartUpdated,
  fetchCart,
  formatCartMoney,
  getCartToken,
  lineCount,
  lineTitle,
  lineVariantLabel,
  patchCartLine,
} from "../lib/cart";
import type { ProductCardProduct } from "./ProductCard";

type Props = {
  apiUrl: string;
  locale: string;
  labels: {
    title: string;
    empty: string;
    checkout: string;
    remove: string;
    freeShipProgress: string;
    freeShipUnlocked: string;
    open: string;
    close: string;
    viewCart: string;
    subtotal: string;
    qty: string;
    promo: string;
    taxesNote: string;
    completeWith: string;
    addToCart: string;
    decreaseQty: string;
    increaseQty: string;
    discount: string;
    apply: string;
    discountInvalid: string;
    badgeExtra: string;
    badgeDismiss: string;
    upsellGoto: string;
  };
};

const FREE_SHIP_THRESHOLD = 4900;
const PROMO_CODE = "WELCOME10";
const BADGE_DISMISS_KEY = "nestpaw:cart-badge-dismissed";

type UpsellItem = {
  productId: string;
  variantId: string;
  title: string;
  slug?: string;
  image?: { url: string; alt: string };
  price: number;
  compareAtPrice?: number | null;
};

function productHref(
  locale: string,
  translations: { locale: string; slug?: string }[],
) {
  const slug =
    translations.find((t) => t.locale === locale)?.slug ??
    translations.find((t) => t.slug)?.slug;
  return slug ? `/${locale}/products/${slug}` : undefined;
}

function CartGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.6L20 8H7" />
      <circle cx="10" cy="20" r="1.2" />
      <circle cx="17" cy="20" r="1.2" />
    </svg>
  );
}

function CloseGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function toUpsell(product: ProductCardProduct, locale: string): UpsellItem | null {
  const variant = product.variants?.[0];
  if (!variant) return null;
  const tr =
    product.translations.find((t) => t.locale === locale) ??
    product.translations[0];
  const media = product.media?.[0];
  return {
    productId: product.id,
    variantId: variant.id,
    title: tr?.title ?? "Item",
    slug: tr?.slug,
    image: media ? { url: media.url, alt: media.alt || tr?.title || "" } : undefined,
    price: variant.price,
    compareAtPrice: variant.compareAtPrice,
  };
}

export default function CartDrawer({ apiUrl, locale, labels }: Props) {
  const titleId = useId();
  const discountId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [code, setCode] = useState("");
  const [upsells, setUpsells] = useState<UpsellItem[]>([]);
  const [upsellIndex, setUpsellIndex] = useState(0);
  const [badgeVisible, setBadgeVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setBadgeVisible(localStorage.getItem(BADGE_DISMISS_KEY) !== "1");
    } catch {
      setBadgeVisible(true);
    }
  }, []);

  async function load() {
    try {
      const data = await fetchCart(apiUrl);
      setCart(data);
      setError(null);
      if (data.discountCode) setCode(data.discountCode);
    } catch {
      setError("Could not load cart");
    }
  }

  async function loadUpsells(current: Cart | null) {
    try {
      const inCart = new Set(
        current?.lines
          .map((line) => line.variant.product.id)
          .filter((id): id is string => Boolean(id)) ?? [],
      );
      const productId = current?.lines[0]?.variant.product.id;
      let items: ProductCardProduct[] = [];

      if (productId) {
        const res = await fetch(
          `${apiUrl}/products/${productId}/related?locale=${locale}&take=6`,
        );
        if (res.ok) {
          const data = (await res.json()) as { items?: ProductCardProduct[] };
          items = Array.isArray(data.items) ? data.items : [];
        }
      }

      if (!items.length) {
        const res = await fetch(`${apiUrl}/products?locale=${locale}&take=8`);
        if (res.ok) {
          const data = (await res.json()) as { items?: ProductCardProduct[] };
          items = Array.isArray(data.items) ? data.items : [];
        }
      }

      const next = items
        .filter((p) => !inCart.has(p.id))
        .map((p) => toUpsell(p, locale))
        .filter((p): p is UpsellItem => Boolean(p))
        .slice(0, 3);

      setUpsells(next);
      setUpsellIndex(0);
    } catch {
      setUpsells([]);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only cart load
  useEffect(() => {
    void load();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: stable event handlers bind once
  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      void load().then(() => undefined);
    };
    const onUpdated = () => {
      void load();
    };
    window.addEventListener(CART_OPEN_EVENT, onOpen);
    window.addEventListener(CART_UPDATED_EVENT, onUpdated);
    return () => {
      window.removeEventListener(CART_OPEN_EVENT, onOpen);
      window.removeEventListener(CART_UPDATED_EVENT, onUpdated);
    };
  }, []);

  const upsellKey =
    cart?.lines
      .map((line) => line.variant.product.id ?? line.id)
      .join(",") ?? "";

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh when open cart membership changes
  useEffect(() => {
    if (!open || !cart) return;
    void loadUpsells(cart);
  }, [open, cart?.token, upsellKey]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function setLineQuantity(lineId: string, quantity: number) {
    if (!cart) return;
    setBusy(true);
    setError(null);
    try {
      const next = await patchCartLine(apiUrl, cart.token, lineId, quantity);
      setCart(next);
      dispatchCartUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function applyDiscount(nextCode = code) {
    if (!cart || !nextCode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const next = await applyCartDiscount(apiUrl, cart.token, nextCode.trim());
      setCart(next);
      setCode(next.discountCode ?? nextCode.trim().toUpperCase());
      dispatchCartUpdated();
    } catch {
      setError(labels.discountInvalid);
    } finally {
      setBusy(false);
    }
  }

  async function addUpsell(item: UpsellItem) {
    setBusy(true);
    setError(null);
    try {
      const next = await addCartItem(
        apiUrl,
        cart?.token ?? getCartToken(),
        item.variantId,
        1,
      );
      setCart(next);
      dispatchCartUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  function dismissBadge() {
    setBadgeVisible(false);
    try {
      localStorage.setItem(BADGE_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  const count = lineCount(cart);
  const remaining = cart
    ? Math.max(0, FREE_SHIP_THRESHOLD - cart.totals.subtotal)
    : FREE_SHIP_THRESHOLD;
  const freeShipMsg =
    remaining === 0
      ? labels.freeShipUnlocked
      : labels.freeShipProgress.replace(
          "{amount}",
          (remaining / 100).toFixed(2),
        );
  const checkoutTotal = cart
    ? formatCartMoney(cart.totals.total)
    : formatCartMoney(0);
  const activeUpsell = upsells[upsellIndex] ?? null;

  return (
    <>
      <button
        type="button"
        className="site-header__cart-btn"
        aria-label={labels.open}
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        <CartGlyph className="site-nav__icon" />
        <span className="site-header__cart-label">{labels.title}</span>
        {count > 0 ? (
          <span className="site-header__cart-badge" aria-hidden="true">
            {count}
          </span>
        ) : null}
      </button>

      {mounted
        ? createPortal(
            <div
              className={`cart-drawer${open ? " is-open" : ""}`}
              aria-hidden={!open}
            >
              <button
                type="button"
                className="cart-drawer__backdrop"
                tabIndex={open ? 0 : -1}
                aria-label={labels.close}
                onClick={() => setOpen(false)}
              />
              <aside
                className="cart-drawer__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                inert={!open ? true : undefined}
              >
                <header className="cart-drawer__header">
                  <h2 id={titleId} className="cart-drawer__title">
                    {labels.title}
                  </h2>
                  <button
                    ref={closeRef}
                    type="button"
                    className="cart-drawer__close"
                    aria-label={labels.close}
                    onClick={() => setOpen(false)}
                  >
                    <CloseGlyph className="cart-drawer__close-icon" />
                  </button>
                </header>

                <div className="cart-drawer__notices">
                  <p className="cart-drawer__promo">{labels.promo}</p>
                  <div
                    className={
                      remaining === 0
                        ? "cart-drawer__freeship is-unlocked"
                        : "cart-drawer__freeship"
                    }
                  >
                    <p className="cart-drawer__freeship-copy">{freeShipMsg}</p>
                  </div>
                </div>

                <div className="cart-drawer__body">
                  {!cart ? (
                    <p>{error ?? "…"}</p>
                  ) : !cart.lines.length ? (
                    <p className="cart-drawer__empty">{labels.empty}</p>
                  ) : (
                    <ul className="cart-drawer__lines">
                      {cart.lines.map((line) => {
                        const title = lineTitle(line, locale);
                        const variantLabel = lineVariantLabel(line);
                        const img = line.variant.product.media?.[0];
                        const href = productHref(
                          locale,
                          line.variant.product.translations,
                        );
                        return (
                          <li className="cart-line cart-drawer__line" key={line.id}>
                            {href ? (
                              <a
                                className="cart-line__media"
                                href={href}
                                aria-label={title}
                              >
                                {img ? (
                                  <img
                                    src={img.url}
                                    alt=""
                                    loading="lazy"
                                  />
                                ) : null}
                              </a>
                            ) : (
                              <div
                                className="cart-line__media"
                                aria-hidden={!img}
                              >
                                {img ? (
                                  <img
                                    src={img.url}
                                    alt={img.alt || title}
                                    loading="lazy"
                                  />
                                ) : null}
                              </div>
                            )}
                            <div className="cart-line__body">
                              <div className="cart-line__header">
                                <div className="cart-line__info">
                                  {href ? (
                                    <a className="cart-line__title" href={href}>
                                      {title}
                                    </a>
                                  ) : (
                                    <p className="cart-line__title">{title}</p>
                                  )}
                                  {variantLabel ? (
                                    <p className="cart-line__variant">
                                      {variantLabel}
                                    </p>
                                  ) : null}
                                </div>
                                <p className="cart-line__price">
                                  {formatCartMoney(
                                    line.variant.price * line.quantity,
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
                                    aria-label={labels.decreaseQty}
                                    disabled={busy || line.quantity <= 1}
                                    onClick={() =>
                                      void setLineQuantity(
                                        line.id,
                                        line.quantity - 1,
                                      )
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
                                    aria-label={labels.increaseQty}
                                    disabled={busy || line.quantity >= 99}
                                    onClick={() =>
                                      void setLineQuantity(
                                        line.id,
                                        line.quantity + 1,
                                      )
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  className="cart-line__remove"
                                  disabled={busy}
                                  onClick={() =>
                                    void setLineQuantity(line.id, 0)
                                  }
                                >
                                  {labels.remove}
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {activeUpsell ? (
                    <section
                      className="cart-drawer__upsell"
                      aria-label={labels.completeWith}
                    >
                      <div className="cart-drawer__upsell-head">
                        <h3 className="cart-drawer__upsell-title">
                          {labels.completeWith}
                        </h3>
                        {upsells.length > 1 ? (
                          <div
                            className="cart-drawer__upsell-dots"
                            role="tablist"
                            aria-label={labels.completeWith}
                          >
                            {upsells.map((item, index) => (
                              <button
                                key={item.productId}
                                type="button"
                                role="tab"
                                aria-selected={index === upsellIndex}
                                className={`cart-drawer__upsell-dot${
                                  index === upsellIndex ? " is-active" : ""
                                }`}
                                aria-label={labels.upsellGoto.replace(
                                  "{n}",
                                  String(index + 1),
                                )}
                                onClick={() => setUpsellIndex(index)}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="cart-drawer__upsell-item">
                        {activeUpsell.slug ? (
                          <a
                            className="cart-drawer__upsell-media"
                            href={`/${locale}/products/${activeUpsell.slug}`}
                            aria-label={activeUpsell.title}
                          >
                            {activeUpsell.image ? (
                              <img
                                src={activeUpsell.image.url}
                                alt=""
                                loading="lazy"
                              />
                            ) : null}
                          </a>
                        ) : (
                          <div className="cart-drawer__upsell-media">
                            {activeUpsell.image ? (
                              <img
                                src={activeUpsell.image.url}
                                alt={activeUpsell.image.alt}
                                loading="lazy"
                              />
                            ) : null}
                          </div>
                        )}
                        <div className="cart-drawer__upsell-meta">
                          {activeUpsell.slug ? (
                            <a
                              className="cart-drawer__upsell-name"
                              href={`/${locale}/products/${activeUpsell.slug}`}
                            >
                              {activeUpsell.title}
                            </a>
                          ) : (
                            <p className="cart-drawer__upsell-name">
                              {activeUpsell.title}
                            </p>
                          )}
                          <p className="cart-drawer__upsell-prices">
                            <span className="cart-drawer__upsell-price">
                              {formatCartMoney(activeUpsell.price)}
                            </span>
                            {activeUpsell.compareAtPrice &&
                            activeUpsell.compareAtPrice >
                              activeUpsell.price ? (
                              <s className="cart-drawer__upsell-compare">
                                {formatCartMoney(activeUpsell.compareAtPrice)}
                              </s>
                            ) : null}
                          </p>
                          <button
                            type="button"
                            className="cart-drawer__upsell-add"
                            disabled={busy}
                            onClick={() => void addUpsell(activeUpsell)}
                          >
                            {labels.addToCart}
                          </button>
                        </div>
                      </div>
                    </section>
                  ) : null}
                </div>

                <footer className="cart-drawer__footer">
                  <p className="cart-drawer__taxes">{labels.taxesNote}</p>
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
                      onChange={(event) => setCode(event.target.value)}
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
                    className="btn btn--primary cart-drawer__checkout"
                    href={`/${locale}/checkout`}
                  >
                    <span>{labels.checkout}</span>
                    <span aria-hidden="true">·</span>
                    <span>{checkoutTotal}</span>
                  </a>
                  <a
                    className="cart-drawer__view"
                    href={`/${locale}/cart`}
                  >
                    {labels.viewCart}
                  </a>
                </footer>

                {badgeVisible ? (
                  <div className="cart-drawer__badge">
                    <button
                      type="button"
                      className="cart-drawer__badge-apply"
                      disabled={busy}
                      onClick={() => {
                        setCode(PROMO_CODE);
                        void applyDiscount(PROMO_CODE);
                      }}
                    >
                      {labels.badgeExtra}
                    </button>
                    <button
                      type="button"
                      className="cart-drawer__badge-close"
                      aria-label={labels.badgeDismiss}
                      onClick={dismissBadge}
                    >
                      ×
                    </button>
                  </div>
                ) : null}
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
