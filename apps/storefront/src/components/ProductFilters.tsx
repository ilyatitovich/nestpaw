import { useMemo, useState } from "react";

export type FilterProduct = {
  id: string;
  translations: { locale: string; title: string; slug: string }[];
  media: { url: string; alt: string }[];
  variants: { price: number }[];
  metafields?: { namespace: string; key: string; value: unknown }[];
};

type Props = {
  locale: string;
  products: FilterProduct[];
  labels: {
    sort: string;
    filterLife: string;
    filterType: string;
    all: string;
    from: string;
  };
};

function meta(p: FilterProduct, key: string) {
  const m = p.metafields?.find((x) => x.namespace === "pet" && x.key === key);
  return typeof m?.value === "string" ? m.value : "";
}

export default function ProductFilters({ locale, products, labels }: Props) {
  const [life, setLife] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("featured");

  const lifeOptions = useMemo(() => {
    const set = new Set(products.map((p) => meta(p, "life_stage")).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [products]);

  const typeOptions = useMemo(() => {
    const set = new Set(
      products.map((p) => meta(p, "product_type")).filter(Boolean),
    );
    return ["all", ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      if (life !== "all" && meta(p, "life_stage") !== life) return false;
      if (type !== "all" && meta(p, "product_type") !== type) return false;
      return true;
    });
    if (sort === "price-asc") {
      list = [...list].sort(
        (a, b) => (a.variants[0]?.price ?? 0) - (b.variants[0]?.price ?? 0),
      );
    } else if (sort === "price-desc") {
      list = [...list].sort(
        (a, b) => (b.variants[0]?.price ?? 0) - (a.variants[0]?.price ?? 0),
      );
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
  }, [products, life, type, sort, locale]);

  return (
    <div>
      <div className="plp-toolbar">
        <label>
          {labels.filterLife}
          <select value={life} onChange={(e) => setLife(e.target.value)}>
            {lifeOptions.map((o) => (
              <option key={o} value={o}>
                {o === "all" ? labels.all : o}
              </option>
            ))}
          </select>
        </label>
        <label>
          {labels.filterType}
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {typeOptions.map((o) => (
              <option key={o} value={o}>
                {o === "all" ? labels.all : o}
              </option>
            ))}
          </select>
        </label>
        <label>
          {labels.sort}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="featured">Featured</option>
            <option value="price-asc">Price ↑</option>
            <option value="price-desc">Price ↓</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>
      <div className="product-grid">
        {filtered.map((p) => {
          const tr =
            p.translations.find((x) => x.locale === locale) ?? p.translations[0];
          const price = p.variants[0]?.price ?? 0;
          const img = p.media[0];
          return (
            <a
              className="product-card"
              key={p.id}
              href={`/${locale}/products/${tr?.slug}`}
            >
              <div className="product-card__media">
                {img ? (
                  <img src={img.url} alt={img.alt || tr?.title || ""} loading="lazy" />
                ) : null}
              </div>
              <h2 className="product-card__title">{tr?.title}</h2>
              <p className="product-card__price">
                {labels.from} €{(price / 100).toFixed(2)}
              </p>
            </a>
          );
        })}
      </div>
    </div>
  );
}
