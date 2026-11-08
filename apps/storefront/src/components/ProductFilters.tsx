import { useMemo, useState } from "react";
import { localizePath } from "@/i18n/ui";
import ProductCard, { type ProductCardProduct } from "./ProductCard";

export type FilterProduct = ProductCardProduct & {
  metafields?: { namespace: string; key: string; value: unknown }[];
};

type Props = {
  locale: string;
  apiUrl: string;
  products: FilterProduct[];
  labels: {
    sort: string;
    filterLife: string;
    filterType: string;
    all: string;
    from: string;
    sale: string;
    add: string;
    wishlist: string;
    wishlistAdded: string;
    addError: string;
  };
};

function meta(p: FilterProduct, key: string) {
  const m = p.metafields?.find((x) => x.namespace === "pet" && x.key === key);
  return typeof m?.value === "string" ? m.value : "";
}

export default function ProductFilters({
  locale,
  apiUrl,
  products,
  labels,
}: Props) {
  const [life, setLife] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("featured");

  const lifeOptions = useMemo(() => {
    const set = new Set(
      products.map((p) => meta(p, "life_stage")).filter(Boolean),
    );
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
            p.translations.find((x) => x.locale === locale) ??
            p.translations[0];
          return (
            <ProductCard
              key={p.id}
              product={p}
              locale={locale}
              apiUrl={apiUrl}
              href={localizePath(locale, `/products/${tr?.slug}`)}
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
  );
}
