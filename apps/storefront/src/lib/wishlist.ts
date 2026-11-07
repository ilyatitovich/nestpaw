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
