import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CART_OPEN_EVENT,
  CART_UPDATED_EVENT,
  type Cart,
  dispatchCartUpdated,
  fetchCart,
  lineCount,
  lineTitle,
  patchCartLine,
} from "../lib/cart";

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
  };
};

const FREE_SHIP_THRESHOLD = 4900;

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

export default function CartDrawer({ apiUrl, locale, labels }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function load() {
    try {
      const data = await fetchCart(apiUrl);
      setCart(data);
      setError(null);
    } catch {
      setError("Could not load cart");
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
      void load();
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
                    {count > 0 ? ` (${count})` : ""}
                  </h2>
                  <button
                    ref={closeRef}
                    type="button"
                    className="cart-drawer__close"
                    aria-label={labels.close}
                    onClick={() => setOpen(false)}
                  >
                    <CloseGlyph className="site-nav__icon" />
                  </button>
                </header>

                <div className="cart-drawer__body">
                  {!cart ? (
                    <p>{error ?? "…"}</p>
                  ) : !cart.lines.length ? (
                    <p className="cart-drawer__empty">{labels.empty}</p>
                  ) : (
                    <>
                      <p className="cart__freeship">{freeShipMsg}</p>
                      <ul className="cart-drawer__lines">
                        {cart.lines.map((line) => {
                          const title = lineTitle(line, locale);
                          const img = line.variant.product.media?.[0];
                          return (
                            <li className="cart-drawer__line" key={line.id}>
                              <div className="cart-drawer__line-media">
                                {img ? (
                                  <img
                                    src={img.url}
                                    alt={img.alt || title}
                                    loading="lazy"
                                  />
                                ) : null}
                              </div>
                              <div className="cart-drawer__line-meta">
                                <strong>{title}</strong>
                                <div className="cart-drawer__line-controls">
                                  <label>
                                    {labels.qty}{" "}
                                    <input
                                      type="number"
                                      min={1}
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
                                    onClick={() =>
                                      void setLineQuantity(line.id, 0)
                                    }
                                  >
                                    {labels.remove}
                                  </button>
                                </div>
                              </div>
                              <div className="cart-drawer__line-price">
                                €
                                {(
                                  (line.variant.price * line.quantity) /
                                  100
                                ).toFixed(2)}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="cart-drawer__totals">
                        <span>{labels.subtotal}</span>
                        <strong>
                          €{(cart.totals.subtotal / 100).toFixed(2)}
                        </strong>
                      </div>
                    </>
                  )}
                </div>

                <footer className="cart-drawer__footer">
                  <a
                    className="btn btn--primary cart-drawer__checkout"
                    href={`/${locale}/cart`}
                  >
                    {labels.checkout}
                  </a>
                  <a
                    className="cart-drawer__view"
                    href={`/${locale}/cart`}
                    onClick={() => setOpen(false)}
                  >
                    {labels.viewCart}
                  </a>
                </footer>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
