/** Extract VAT included in a gross (tax-inclusive) amount. */
export function extractIncludedTax(grossCents: number, rateBps: number): number {
  if (grossCents <= 0 || rateBps <= 0) return 0;
  const net = Math.round((grossCents * 10_000) / (10_000 + rateBps));
  return Math.max(0, grossCents - net);
}

/** Grundpreis: cents per unit (e.g. per kg) from pack price and pack grams. */
export function unitPriceCents(
  packPriceCents: number,
  packGrams: number,
  perGrams = 1000,
): number | null {
  if (packGrams <= 0 || packPriceCents < 0) return null;
  return Math.round((packPriceCents * perGrams) / packGrams);
}
