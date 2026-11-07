import { useEffect, useState } from "react";

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
    submit: string;
    empty: string;
    from: string;
  };
  initialQuery?: string;
};

export default function SearchClient({
  apiUrl,
  locale,
  labels,
  initialQuery = "",
}: Props) {
  const [q, setQ] = useState(initialQuery);
  const [items, setItems] = useState<Product[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      setItems([]);
      setSearched(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `${apiUrl}/search?q=${encodeURIComponent(trimmed)}&locale=${locale}`,
      );
      const data = (await res.json()) as { items: Product[] };
      setItems(data.items ?? []);
      setSearched(true);
      const url = new URL(window.location.href);
      url.searchParams.set("q", trimmed);
      window.history.replaceState({}, "", url.toString());
    } finally {
      setBusy(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only initial search
  useEffect(() => {
    if (initialQuery) void run(initialQuery);
  }, []);

  return (
    <div>
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(q);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={labels.placeholder}
          aria-label={labels.placeholder}
        />
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {labels.submit}
        </button>
      </form>
      {searched && !items.length ? <p>{labels.empty}</p> : null}
      <div className="product-grid">
        {items.map((p) => {
          const tr =
            p.translations.find((x) => x.locale === locale) ??
            p.translations[0];
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
                  <img
                    src={img.url}
                    alt={img.alt || tr?.title || ""}
                    loading="lazy"
                  />
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
