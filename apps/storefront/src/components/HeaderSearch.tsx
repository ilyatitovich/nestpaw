import { useCallback, useEffect, useId, useRef, useState } from "react";
import { localizePath } from "../i18n/ui";
import { createPortal } from "react-dom";

type Product = {
  id: string;
  translations: { locale: string; title: string; slug: string }[];
  media: { url: string; alt: string }[];
  variants: { price: number }[];
};

type Props = {
  apiUrl: string;
  locale: string;
  labels: {
    placeholder: string;
    from: string;
    seeAllResults: string;
    noResults: string;
    loading: string;
  };
};

const DEBOUNCE_MS = 300;
const TAKE = 8;

function SearchGlyph({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export default function HeaderSearch({ apiUrl, locale, labels }: Props) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePanelPosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPanelStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 280),
      zIndex: 60,
    });
  }, []);

  const runSearch = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      abortRef.current?.abort();
      if (!trimmed) {
        setItems([]);
        setSearched(false);
        setBusy(false);
        setOpen(false);
        setActiveIndex(-1);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      updatePanelPosition();
      setOpen(true);

      try {
        const res = await fetch(
          `${apiUrl}/search?q=${encodeURIComponent(trimmed)}&locale=${locale}&take=${TAKE}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { items: Product[] };
        setItems(data.items ?? []);
        setSearched(true);
        setActiveIndex(-1);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setItems([]);
        setSearched(true);
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    },
    [apiUrl, locale, updatePanelPosition],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void runSearch(q);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [q, runSearch]);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const onReposition = () => updatePanelPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      const panel = document.getElementById(listboxId);
      if (panel?.contains(target)) return;
      setOpen(false);
      setActiveIndex(-1);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, listboxId]);

  function goToSearchPage(query = q) {
    const trimmed = query.trim();
    if (!trimmed) return;
    window.location.href = `${localizePath(locale, "/search")}?q=${encodeURIComponent(trimmed)}`;
  }

  function productHref(product: Product) {
    const tr =
      product.translations.find((x) => x.locale === locale) ??
      product.translations[0];
    return localizePath(locale, `/products/${tr?.slug ?? ""}`);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) {
        window.location.href = productHref(items[activeIndex]);
        return;
      }
      goToSearchPage();
    }
  }

  const showPanel = mounted && open && q.trim().length > 0;

  return (
    <div className="header-search" ref={rootRef}>
      <SearchGlyph className="header-search__icon" />
      <input
        ref={inputRef}
        className="header-search__input"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          if (q.trim()) {
            updatePanelPosition();
            setOpen(true);
          }
        }}
        onKeyDown={onKeyDown}
        placeholder={labels.placeholder}
        aria-label={labels.placeholder}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        autoComplete="off"
      />
      {showPanel
        ? createPortal(
            <div
              className="header-search__panel"
              id={listboxId}
              role="listbox"
              style={panelStyle}
            >
              <div className="header-search__status" aria-live="polite">
                {busy
                  ? labels.loading
                  : searched && !items.length
                    ? labels.noResults
                    : null}
              </div>
              {!busy && items.length
                ? items.map((product, index) => {
                    const tr =
                      product.translations.find((x) => x.locale === locale) ??
                      product.translations[0];
                    const price = product.variants[0]?.price ?? 0;
                    const img = product.media[0];
                    return (
                      <a
                        key={product.id}
                        id={`${listboxId}-option-${index}`}
                        role="option"
                        aria-selected={index === activeIndex}
                        className={`header-search__item${index === activeIndex ? " is-active" : ""}`}
                        href={productHref(product)}
                        onMouseEnter={() => setActiveIndex(index)}
                      >
                        <div className="header-search__thumb">
                          {img ? (
                            <img
                              src={img.url}
                              alt={img.alt || tr?.title || ""}
                              loading="lazy"
                            />
                          ) : null}
                        </div>
                        <div className="header-search__meta">
                          <span className="header-search__title">
                            {tr?.title}
                          </span>
                          <span className="header-search__price">
                            {labels.from} €{(price / 100).toFixed(2)}
                          </span>
                        </div>
                      </a>
                    );
                  })
                : null}
              <button
                type="button"
                className="header-search__see-all"
                onClick={() => goToSearchPage()}
              >
                {labels.seeAllResults} →
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
