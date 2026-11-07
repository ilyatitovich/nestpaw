export type DiscountLike = {
  type: "percentage" | "fixed_amount" | "free_shipping";
  value: number;
};

export function computeDiscountAmount(
  discount: DiscountLike,
  subtotal: number,
) {
  if (discount.type === "percentage") {
    return Math.min(subtotal, Math.floor((subtotal * discount.value) / 100));
  }
  if (discount.type === "fixed_amount") {
    return Math.min(subtotal, discount.value);
  }
  return 0;
}
