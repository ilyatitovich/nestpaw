import { type CSSProperties, useEffect, useId, useMemo, useState } from "react";
import ProductCard from "./ProductCard";

type Product = {
  id: string;
  translations: { locale: string; title: string; slug: string }[];
  media: { url: string; alt: string }[];
  variants: {
    id: string;
    price: number;
    compareAtPrice?: number | null;
    option1?: string | null;
  }[];
  metafields?: { namespace: string; key: string; value: unknown }[];
};

type SortKey = "relevance" | "price-asc" | "price-desc" | "name";
type ViewMode = "grid" | "list";
type FacetKey = "species" | "life_stage" | "product_type" | "size_class";

type Props = {
  apiUrl: string;
  locale: string;
  labels: {
    empty: string;
    from: string;
    clearAll: string;
    queryChip: string;
    onSale: string;
    price: string;
    priceMin: string;
    priceMax: string;
    filters: string;
    sort: string;
    sortRelevance: string;
    sortPriceAsc: string;
    sortPriceDesc: string;
    sortName: string;
    viewGrid: string;
    viewList: string;
    viewGroup: string;
    noQuery: string;
    removeFilter: string;
    species: string;
    lifeStage: string;
    type: string;
    size: string;
    sale: string;
    loading: string;
    add: string;
    wishlist: string;
    wishlistAdded: string;
    addError: string;
  };
  initialQuery?: string;
};

const TAKE = 100;
const FACETS: { key: FacetKey; labelKey: keyof Props["labels"] }[] = [
  { key: "species", labelKey: "species" },
  { key: "life_stage", labelKey: "lifeStage" },
  { key: "product_type", labelKey: "type" },
  { key: "size_class", labelKey: "size" },
];

function meta(p: Product, key: string) {
  const m = p.metafields?.find((x) => x.namespace === "pet" && x.key === key);
  return typeof m?.value === "string" ? m.value : "";
}

function cheapestPrice(p: Product) {
  const prices = p.variants
    .map((v) => v.price)
    .filter((n) => Number.isFinite(n));
  return prices.length ? Math.min(...prices) : 0;
}

function isOnSale(p: Product) {
  return p.variants.some(
    (v) =>
      v.compareAtPrice != null &&
      v.compareAtPrice > 0 &&
      v.compareAtPrice > v.price,
  );
}

function formatEuro(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}

function parseListParam(raw: string | null) {
  if (!raw) return [] as string[];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const sortRaw = params.get("sort");
  const sort: SortKey =
    sortRaw === "price-asc" ||
    sortRaw === "price-desc" ||
    sortRaw === "name" ||
    sortRaw === "relevance"
      ? sortRaw
      : "relevance";
  const view: ViewMode = params.get("view") === "list" ? "list" : "grid";
  const minRaw = params.get("min");
  const maxRaw = params.get("max");
  return {
    q: params.get("q") ?? "",
    onSale: params.get("onSale") === "1",
    species: parseListParam(params.get("species")),
    life_stage: parseListParam(params.get("life_stage")),
    product_type: parseListParam(params.get("product_type")),
    size_class: parseListParam(params.get("size_class")),
    sort,
    view,
    min: minRaw != null && minRaw !== "" ? Number(minRaw) : null,
    max: maxRaw != null && maxRaw !== "" ? Number(maxRaw) : null,
  };
}

function writeUrlState(next: {
  q: string;
  onSale: boolean;
  species: string[];
  life_stage: string[];
  product_type: string[];
  size_class: string[];
  sort: SortKey;
  view: ViewMode;
  min: number | null;
  max: number | null;
  priceFloor: number;
  priceCeil: number;
}) {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  if (next.q.trim()) params.set("q", next.q.trim());
  else params.delete("q");

  if (next.onSale) params.set("onSale", "1");
  else params.delete("onSale");

  for (const key of [
    "species",
    "life_stage",
    "product_type",
    "size_class",
  ] as const) {
    if (next[key].length) params.set(key, next[key].join(","));
    else params.delete(key);
  }

  if (next.sort !== "relevance") params.set("sort", next.sort);
  else params.delete("sort");

  if (next.view !== "grid") params.set("view", next.view);
  else params.delete("view");

  const priceTouched =
    (next.min != null && next.min > next.priceFloor) ||
    (next.max != null && next.max < next.priceCeil);
  if (priceTouched && next.min != null) params.set("min", String(next.min));
  else params.delete("min");
  if (priceTouched && next.max != null) params.set("max", String(next.max));
  else params.delete("max");

  window.history.replaceState({}, "", url.toString());
}

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor" />
      <rect x="10" y="2" width="6" height="6" rx="1" fill="currentColor" />
      <rect x="2" y="10" width="6" height="6" rx="1" fill="currentColor" />
      <rect x="10" y="10" width="6" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect x="2" y="3" width="14" height="2.5" rx="1" fill="currentColor" />
      <rect x="2" y="7.75" width="14" height="2.5" rx="1" fill="currentColor" />
      <rect x="2" y="12.5" width="14" height="2.5" rx="1" fill="currentColor" />
    </svg>
  );
}

export default function SearchClient({
  apiUrl,
  locale,
  labels,
  initialQuery = "",
}: Props) {
  const baseId = useId();
  const [q, setQ] = useState(initialQuery);
  const [items, setItems] = useState<Product[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [onSale, setOnSale] = useState(false);
  const [selected, setSelected] = useState<Record<FacetKey, string[]>>({
    species: [],
    life_stage: [],
    product_type: [],
    size_class: [],
  });
  const [sort, setSort] = useState<SortKey>("relevance");
  const [view, setView] = useState<ViewMode>("grid");
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  async function run(query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      setItems([]);
      setSearched(false);
      setQ("");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `${apiUrl}/search?q=${encodeURIComponent(trimmed)}&locale=${locale}&take=${TAKE}`,
      );
      const data = (await res.json()) as { items: Product[] };
      setItems(data.items ?? []);
      setSearched(true);
      setQ(trimmed);
    } finally {
      setBusy(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only hydrate from URL
  useEffect(() => {
    const state = readUrlState();
    const fromUrl = state.q || initialQuery;
    setOnSale(state.onSale);
    setSelected({
      species: state.species,
      life_stage: state.life_stage,
      product_type: state.product_type,
      size_class: state.size_class,
    });
    setSort(state.sort);
    setView(state.view);
    setPriceMin(state.min);
    setPriceMax(state.max);
    if (fromUrl) {
      setQ(fromUrl);
      void run(fromUrl);
    }
    setHydrated(true);
  }, []);

  const priceBounds = useMemo(() => {
    if (!items.length) return { floor: 0, ceil: 0 };
    const prices = items.map(cheapestPrice);
    return { floor: Math.min(...prices), ceil: Math.max(...prices) };
  }, [items]);

  const effectiveMin = priceMin ?? priceBounds.floor;
  const effectiveMax = priceMax ?? priceBounds.ceil;

  useEffect(() => {
    if (!items.length) return;
    setPriceMin((prev) =>
      prev == null
        ? priceBounds.floor
        : Math.min(Math.max(prev, priceBounds.floor), priceBounds.ceil),
    );
    setPriceMax((prev) =>
      prev == null
        ? priceBounds.ceil
        : Math.min(Math.max(prev, priceBounds.floor), priceBounds.ceil),
    );
  }, [items, priceBounds.floor, priceBounds.ceil]);

  useEffect(() => {
    if (!hydrated) return;
    writeUrlState({
      q,
      onSale,
      species: selected.species,
      life_stage: selected.life_stage,
      product_type: selected.product_type,
      size_class: selected.size_class,
      sort,
      view,
      min: priceMin,
      max: priceMax,
      priceFloor: priceBounds.floor,
      priceCeil: priceBounds.ceil,
    });
  }, [
    hydrated,
    q,
    onSale,
    selected,
    sort,
    view,
    priceMin,
    priceMax,
    priceBounds.floor,
    priceBounds.ceil,
  ]);

  const facetOptions = useMemo(() => {
    const out: Record<FacetKey, string[]> = {
      species: [],
      life_stage: [],
      product_type: [],
      size_class: [],
    };
    for (const key of Object.keys(out) as FacetKey[]) {
      const set = new Set(items.map((p) => meta(p, key)).filter(Boolean));
      out[key] = Array.from(set).sort((a, b) => a.localeCompare(b));
    }
    return out;
  }, [items]);

  const filtered = useMemo(() => {
    let list = items.filter((p) => {
      if (onSale && !isOnSale(p)) return false;
      for (const key of Object.keys(selected) as FacetKey[]) {
        const values = selected[key];
        if (values.length && !values.includes(meta(p, key))) return false;
      }
      const price = cheapestPrice(p);
      if (price < effectiveMin || price > effectiveMax) return false;
      return true;
    });

    if (sort === "price-asc") {
      list = [...list].sort((a, b) => cheapestPrice(a) - cheapestPrice(b));
    } else if (sort === "price-desc") {
      list = [...list].sort((a, b) => cheapestPrice(b) - cheapestPrice(a));
    } else if (sort === "name") {
      list = [...list].sort((a, b) => {
        const ta =
          a.translations.find((t) => t.locale === locale)?.title ??
          a.translations[0]?.title ??
          "";
        const tb =
          b.translations.find((t) => t.locale === locale)?.title ??
          b.translations[0]?.title ??
          "";
        return ta.localeCompare(tb);
      });
    }
    return list;
  }, [items, onSale, selected, effectiveMin, effectiveMax, sort, locale]);

  const priceActive =
    items.length > 0 &&
    (effectiveMin > priceBounds.floor || effectiveMax < priceBounds.ceil);

  const hasActiveFilters =
    onSale || priceActive || Object.values(selected).some((v) => v.length > 0);

  function toggleFacet(key: FacetKey, value: string) {
    setSelected((prev) => {
      const set = new Set(prev[key]);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...prev, [key]: Array.from(set) };
    });
  }

  function clearFilters({ clearQuery = false } = {}) {
    setOnSale(false);
    setSelected({
      species: [],
      life_stage: [],
      product_type: [],
      size_class: [],
    });
    setPriceMin(priceBounds.floor);
    setPriceMax(priceBounds.ceil);
    if (clearQuery) {
      setQ("");
      setItems([]);
      setSearched(false);
    }
  }

  function onMinChange(value: number) {
    const next = Math.min(value, effectiveMax);
    setPriceMin(Math.max(next, priceBounds.floor));
  }

  function onMaxChange(value: number) {
    const next = Math.max(value, effectiveMin);
    setPriceMax(Math.min(next, priceBounds.ceil));
  }

  const dualRange = priceBounds.ceil > priceBounds.floor;
  const minProgress = dualRange
    ? ((effectiveMin - priceBounds.floor) /
        (priceBounds.ceil - priceBounds.floor)) *
      100
    : 0;
  const maxProgress = dualRange
    ? ((effectiveMax - priceBounds.floor) /
        (priceBounds.ceil - priceBounds.floor)) *
      100
    : 100;

  if (!q.trim() && !searched) {
    return <p className="search-empty">{labels.noQuery}</p>;
  }

  return (
    <div className="search-plp">
      {(q.trim() || hasActiveFilters) && (
        <div className="filter-chips">
          {q.trim() ? (
            <button
              type="button"
              className="filter-chip"
              onClick={() => clearFilters({ clearQuery: true })}
              aria-label={`${labels.removeFilter}: ${labels.queryChip} ${q}`}
            >
              <span>
                {labels.queryChip}: {q}
              </span>
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
          {onSale ? (
            <button
              type="button"
              className="filter-chip"
              onClick={() => setOnSale(false)}
              aria-label={`${labels.removeFilter}: ${labels.onSale}`}
            >
              <span>{labels.onSale}</span>
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
          {FACETS.flatMap(({ key, labelKey }) =>
            selected[key].map((value) => (
              <button
                key={`${key}-${value}`}
                type="button"
                className="filter-chip"
                onClick={() => toggleFacet(key, value)}
                aria-label={`${labels.removeFilter}: ${labels[labelKey]} ${value}`}
              >
                <span>
                  {labels[labelKey]}: {value}
                </span>
                <span aria-hidden="true">×</span>
              </button>
            )),
          )}
          {priceActive ? (
            <button
              type="button"
              className="filter-chip"
              onClick={() => {
                setPriceMin(priceBounds.floor);
                setPriceMax(priceBounds.ceil);
              }}
              aria-label={`${labels.removeFilter}: ${labels.price}`}
            >
              <span>
                {labels.price}: {formatEuro(effectiveMin)} –{" "}
                {formatEuro(effectiveMax)}
              </span>
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
          {hasActiveFilters ? (
            <button
              type="button"
              className="filter-chips__clear"
              onClick={() => clearFilters({ clearQuery: false })}
            >
              {labels.clearAll}
            </button>
          ) : null}
        </div>
      )}

      <div className="search-layout">
        <aside className="search-filters" aria-label={labels.filters}>
          <div className="filter-group">
            <h2 className="filter-group__title">{labels.onSale}</h2>
            <label className="filter-check">
              <input
                type="checkbox"
                checked={onSale}
                onChange={(e) => setOnSale(e.target.checked)}
              />
              <span>{labels.onSale}</span>
            </label>
          </div>

          {FACETS.map(({ key, labelKey }) =>
            facetOptions[key].length ? (
              <div className="filter-group" key={key}>
                <h2 className="filter-group__title">{labels[labelKey]}</h2>
                <ul className="filter-options">
                  {facetOptions[key].map((value) => (
                    <li key={value}>
                      <label className="filter-check">
                        <input
                          type="checkbox"
                          checked={selected[key].includes(value)}
                          onChange={() => toggleFacet(key, value)}
                        />
                        <span>{value}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}

          {dualRange ? (
            <div className="filter-group">
              <h2 className="filter-group__title">{labels.price}</h2>
              <p className="price-range__values">
                {formatEuro(effectiveMin)} – {formatEuro(effectiveMax)}
              </p>
              <div
                className="price-range"
                style={
                  {
                    "--range-min": `${minProgress}%`,
                    "--range-max": `${maxProgress}%`,
                  } as CSSProperties
                }
              >
                <label className="visually-hidden" htmlFor={`${baseId}-min`}>
                  {labels.priceMin}
                </label>
                <input
                  id={`${baseId}-min`}
                  className="price-range__input price-range__input--min"
                  type="range"
                  min={priceBounds.floor}
                  max={priceBounds.ceil}
                  step={1}
                  value={effectiveMin}
                  onChange={(e) => onMinChange(Number(e.target.value))}
                  aria-valuetext={formatEuro(effectiveMin)}
                  style={
                    {
                      "--control-value": effectiveMin,
                    } as CSSProperties
                  }
                />
                <label className="visually-hidden" htmlFor={`${baseId}-max`}>
                  {labels.priceMax}
                </label>
                <input
                  id={`${baseId}-max`}
                  className="price-range__input price-range__input--max"
                  type="range"
                  min={priceBounds.floor}
                  max={priceBounds.ceil}
                  step={1}
                  value={effectiveMax}
                  onChange={(e) => onMaxChange(Number(e.target.value))}
                  aria-valuetext={formatEuro(effectiveMax)}
                  style={
                    {
                      "--control-value": effectiveMax,
                    } as CSSProperties
                  }
                />
              </div>
            </div>
          ) : null}
        </aside>

        <div className="search-results">
          <div className="search-toolbar">
            <label className="search-toolbar__sort">
              <span>{labels.sort}</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
              >
                <option value="relevance">{labels.sortRelevance}</option>
                <option value="price-asc">{labels.sortPriceAsc}</option>
                <option value="price-desc">{labels.sortPriceDesc}</option>
                <option value="name">{labels.sortName}</option>
              </select>
            </label>
            <fieldset className="view-toggle">
              <legend className="visually-hidden">{labels.viewGroup}</legend>
              <button
                type="button"
                className={
                  view === "grid"
                    ? "view-toggle__btn view-toggle__btn--active"
                    : "view-toggle__btn"
                }
                aria-pressed={view === "grid"}
                aria-label={labels.viewGrid}
                onClick={() => setView("grid")}
              >
                <GridIcon />
              </button>
              <button
                type="button"
                className={
                  view === "list"
                    ? "view-toggle__btn view-toggle__btn--active"
                    : "view-toggle__btn"
                }
                aria-pressed={view === "list"}
                aria-label={labels.viewList}
                onClick={() => setView("list")}
              >
                <ListIcon />
              </button>
            </fieldset>
          </div>

          {busy ? <p className="search-empty">{labels.loading}</p> : null}
          {searched && !busy && !filtered.length ? (
            <p className="search-empty">{labels.empty}</p>
          ) : null}

          <div
            className={
              view === "list"
                ? "product-grid product-grid--list"
                : "product-grid"
            }
          >
            {filtered.map((p) => {
              const tr =
                p.translations.find((x) => x.locale === locale) ??
                p.translations[0];
              return (
                <ProductCard
                  key={p.id}
                  product={p}
                  locale={locale}
                  apiUrl={apiUrl}
                  href={`/${locale}/products/${tr?.slug}`}
                  labels={{
                    from: labels.from,
                    sale: labels.sale,
                    add: labels.add,
                    wishlist: labels.wishlist,
                    wishlistAdded: labels.wishlistAdded,
                    addError: labels.addError,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
