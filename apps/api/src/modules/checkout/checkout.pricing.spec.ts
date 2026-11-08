import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeDiscountAmount } from "../discounts/compute-amount.js";
import {
  buildStripeLineItems,
  sumStripeLineItems,
} from "../payments/build-stripe-line-items.js";
import { extractIncludedTax } from "../tax/tax-inclusive.js";

/** Gross (tax-inclusive) totals → Stripe session amount invariant. */
function orderTotals(input: {
  lines: { price: number; quantity: number; name: string }[];
  discountType?: "percentage" | "fixed_amount" | "free_shipping";
  discountValue?: number;
  shipping: number;
  taxBps: number;
  freeShipThreshold?: number;
}) {
  const subtotal = input.lines.reduce((s, l) => s + l.price * l.quantity, 0);
  let discountTotal = 0;
  let shippingTotal = input.shipping;
  let freeShipping = false;
  if (input.discountType && input.discountValue != null) {
    if (input.discountType === "free_shipping") freeShipping = true;
    else {
      discountTotal = computeDiscountAmount(
        { type: input.discountType, value: input.discountValue },
        subtotal,
      );
    }
  }
  const afterDiscount = Math.max(0, subtotal - discountTotal);
  if (
    freeShipping ||
    (input.freeShipThreshold != null &&
      afterDiscount >= input.freeShipThreshold)
  ) {
    shippingTotal = 0;
  }
  const total = afterDiscount + shippingTotal;
  const taxTotal = extractIncludedTax(total, input.taxBps);
  const stripeItems = buildStripeLineItems({
    lineItems: input.lines.map((l) => ({
      name: l.name,
      amount: l.price,
      quantity: l.quantity,
    })),
    shippingAmount: shippingTotal,
    taxAmount: 0,
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

describe("checkout pricing invariant (gross)", () => {
  it("Stripe charge equals gross order total with percentage discount", () => {
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
    assert.ok(result.taxTotal > 0);
    assert.ok(result.taxTotal < result.total);
  });

  it("free shipping threshold zeroes shipping server-side", () => {
    const result = orderTotals({
      lines: [{ name: "Food", price: 5000, quantity: 1 }],
      shipping: 799,
      taxBps: 1900,
      freeShipThreshold: 4900,
    });
    assert.equal(result.shippingTotal, 0);
    assert.equal(sumStripeLineItems(result.stripeItems), result.total);
  });

  it("free_shipping discount zeroes shipping", () => {
    const result = orderTotals({
      lines: [{ name: "Mug", price: 2000, quantity: 1 }],
      discountType: "free_shipping",
      discountValue: 0,
      shipping: 799,
      taxBps: 1900,
    });
    assert.equal(result.shippingTotal, 0);
    assert.equal(sumStripeLineItems(result.stripeItems), result.total);
  });
});

/** Express wallet sheet needs every eligible rate with free-shipping applied. */
function expressShippingRates(input: {
  rates: { id: string; name: string; price: number }[];
  subtotal: number;
  discountTotal: number;
  freeShipThreshold: number;
}) {
  const freeShipping =
    input.subtotal - input.discountTotal >= input.freeShipThreshold;
  return input.rates.map((r) => ({
    id: r.id,
    displayName: r.name,
    amount: freeShipping ? 0 : r.price,
  }));
}

describe("express checkout quote rates", () => {
  it("zeroes every rate amount when free-shipping threshold is met", () => {
    const rates = expressShippingRates({
      rates: [
        { id: "r1", name: "Standard", price: 499 },
        { id: "r2", name: "Express", price: 999 },
      ],
      subtotal: 5000,
      discountTotal: 0,
      freeShipThreshold: 4900,
    });
    assert.equal(rates.length, 2);
    assert.equal(rates[0]?.amount, 0);
    assert.equal(rates[1]?.amount, 0);
    assert.equal(rates[0]?.displayName, "Standard");
  });

  it("keeps priced rates below the free-shipping threshold", () => {
    const rates = expressShippingRates({
      rates: [{ id: "r1", name: "Standard", price: 499 }],
      subtotal: 2000,
      discountTotal: 0,
      freeShipThreshold: 4900,
    });
    assert.equal(rates[0]?.amount, 499);
  });

  it("express PaymentIntent amount matches recomputed gross total", () => {
    const result = orderTotals({
      lines: [{ name: "Food", price: 2500, quantity: 2 }],
      discountType: "percentage",
      discountValue: 10,
      shipping: 599,
      taxBps: 1900,
      freeShipThreshold: 4900,
    });
    // 5000 - 10% = 4500 + 599 shipping (under €49 threshold after discount)
    assert.equal(result.total, 4500 + 599);
    assert.equal(sumStripeLineItems(result.stripeItems), result.total);
  });
});
