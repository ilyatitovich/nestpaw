import type { ProductCardProduct } from "@/components/ProductCard";

const KEY = "nestpaw-wishlist";

export function readWishlistIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeWishlistIds(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify(ids));
}

export function toggleWishlistId(productId: string): boolean {
  const ids = readWishlistIds();
  const next = ids.includes(productId)
    ? ids.filter((id) => id !== productId)
    : [...ids, productId];
  writeWishlistIds(next);
  return next.includes(productId);
}

export async function fetchWishlistProducts(params: {
  apiUrl: string;
  locale: string;
  ids?: string[];
}): Promise<ProductCardProduct[]> {
  const ids = params.ids ?? readWishlistIds();
  if (!ids.length) return [];

  const query = new URLSearchParams({
    locale: params.locale,
    ids: ids.join(","),
    take: String(Math.min(ids.length, 50)),
  });
  const res = await fetch(`${params.apiUrl}/products?${query}`);
  if (!res.ok) throw new Error("wishlist_fetch_failed");
  const data = (await res.json()) as { items?: ProductCardProduct[] };
  const items = Array.isArray(data.items) ? data.items : [];
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((item): item is ProductCardProduct => Boolean(item));

  if (ordered.length !== ids.length) {
    writeWishlistIds(ordered.map((item) => item.id));
  }
  return ordered;
}
