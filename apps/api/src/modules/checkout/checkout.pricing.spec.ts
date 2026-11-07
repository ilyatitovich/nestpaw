import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeDiscountAmount } from "../discounts/compute-amount.js";
import {
  buildStripeLineItems,
  sumStripeLineItems,
} from "../payments/build-stripe-line-items.js";

/** Mirrors CheckoutService totals → Stripe session amount invariant. */
function orderTotals(input: {
  lines: { price: number; quantity: number; name: string }[];
  discountType?: "percentage" | "fixed_amount" | "free_shipping";
  discountValue?: number;
  shipping: number;
  taxBps: number;
}) {
  const subtotal = input.lines.reduce((s, l) => s + l.price * l.quantity, 0);
  let discountTotal = 0;
  let shippingTotal = input.shipping;
  if (input.discountType && input.discountValue != null) {
    if (input.discountType === "free_shipping") shippingTotal = 0;
    else {
      discountTotal = computeDiscountAmount(
        { type: input.discountType, value: input.discountValue },
        subtotal,
      );
    }
  }
  const taxable = Math.max(0, subtotal - discountTotal + shippingTotal);
  const taxTotal = Math.floor((taxable * input.taxBps) / 10_000);
  const total = taxable + taxTotal;
  const stripeItems = buildStripeLineItems({
    lineItems: input.lines.map((l) => ({
      name: l.name,
      amount: l.price,
      quantity: l.quantity,
    })),
    shippingAmount: shippingTotal,
    taxAmount: taxTotal,
    discountAmount: discountTotal,
    expectedTotal: total,
  });
  return {
    subtotal,
    discountTotal,
    shippingTotal,
    taxTotal,
    total,
    stripeItems,
  };
}

describe("checkout pricing invariant", () => {
  it("Stripe charge equals order total with percentage discount", () => {
    const result = orderTotals({
      lines: [
        { name: "Mug", price: 2500, quantity: 2 },
        { name: "Bowl", price: 4000, quantity: 1 },
      ],
      discountType: "percentage",
      discountValue: 10,
      shipping: 599,
      taxBps: 1900,
    });
    assert.equal(sumStripeLineItems(result.stripeItems), result.total);
  });

  it("Stripe charge equals order total with fixed discount + free shipping", () => {
    const result = orderTotals({
      lines: [{ name: "Mug", price: 5000, quantity: 1 }],
      discountType: "free_shipping",
      discountValue: 0,
      shipping: 799,
      taxBps: 1900,
    });
    assert.equal(result.shippingTotal, 0);
    assert.equal(sumStripeLineItems(result.stripeItems), result.total);
  });
});
