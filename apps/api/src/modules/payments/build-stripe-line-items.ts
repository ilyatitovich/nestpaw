export type CheckoutLineInput = {
  name: string;
  amount: number;
  quantity: number;
};

export type StripeLineItem = {
  name: string;
  unitAmount: number;
  quantity: number;
};

/**
 * Build Stripe Checkout line items whose charged total equals `expectedTotal`.
 * Discount is applied to product lines (not shipping/tax); remainder rounding
 * is corrected on the first product line so amount_total matches the order.
 */
export function buildStripeLineItems(params: {
  lineItems: CheckoutLineInput[];
  shippingAmount: number;
  taxAmount: number;
  discountAmount: number;
  expectedTotal: number;
}): StripeLineItem[] {
  if (params.expectedTotal < 0) {
    throw new Error("expectedTotal must be non-negative");
  }

  const subtotal = params.lineItems.reduce(
    (sum, li) => sum + li.amount * li.quantity,
    0,
  );
  const discount = Math.min(Math.max(0, params.discountAmount), subtotal);

  const products: StripeLineItem[] = [];
  let allocatedDiscount = 0;

  for (let i = 0; i < params.lineItems.length; i++) {
    const li = params.lineItems[i]!;
    const lineTotal = li.amount * li.quantity;
    const isLast = i === params.lineItems.length - 1;
    const share = isLast
      ? discount - allocatedDiscount
      : subtotal === 0
        ? 0
        : Math.floor((lineTotal / subtotal) * discount);
    allocatedDiscount += share;
    const discountedTotal = Math.max(0, lineTotal - share);
    products.push({
      name: li.quantity > 1 ? `${li.name} × ${li.quantity}` : li.name,
      unitAmount: discountedTotal,
      quantity: 1,
    });
  }

  const result = products.filter(
    (p, _, arr) => p.unitAmount > 0 || arr.length === 1,
  );

  if (params.shippingAmount > 0) {
    result.push({
      name: "Shipping",
      unitAmount: params.shippingAmount,
      quantity: 1,
    });
  }
  if (params.taxAmount > 0) {
    result.push({
      name: "Tax",
      unitAmount: params.taxAmount,
      quantity: 1,
    });
  }

  // Zero-total free order: single placeholder line (Stripe rejects empty line_items)
  if (result.length === 0 || result.every((r) => r.unitAmount === 0)) {
    return [{ name: "Order", unitAmount: params.expectedTotal, quantity: 1 }];
  }

  const sum = result.reduce((s, li) => s + li.unitAmount * li.quantity, 0);
  const delta = params.expectedTotal - sum;
  if (delta !== 0) {
    const adjustable =
      result.find((r) => r.name !== "Shipping" && r.name !== "Tax") ??
      result[0];
    if (!adjustable) {
      throw new Error("No line items to adjust");
    }
    adjustable.unitAmount = Math.max(0, adjustable.unitAmount + delta);
  }

  const finalSum = result.reduce((s, li) => s + li.unitAmount * li.quantity, 0);
  if (finalSum !== params.expectedTotal) {
    throw new Error(
      `Stripe line items sum ${finalSum} !== expected total ${params.expectedTotal}`,
    );
  }

  return result;
}

export function sumStripeLineItems(items: StripeLineItem[]): number {
  return items.reduce((s, li) => s + li.unitAmount * li.quantity, 0);
}
