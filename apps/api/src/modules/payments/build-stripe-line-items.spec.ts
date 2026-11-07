import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStripeLineItems,
  sumStripeLineItems,
} from "./build-stripe-line-items.js";

describe("buildStripeLineItems", () => {
  it("matches expected total with percentage-style discount", () => {
    const items = buildStripeLineItems({
      lineItems: [
        { name: "Mug", amount: 2500, quantity: 2 },
        { name: "Bowl", amount: 3000, quantity: 1 },
      ],
      shippingAmount: 500,
      taxAmount: 190,
      discountAmount: 800,
      expectedTotal: 2500 * 2 + 3000 - 800 + 500 + 190,
    });
    assert.equal(sumStripeLineItems(items), 7890);
  });

  it("matches expected total when discount clears subtotal", () => {
    const items = buildStripeLineItems({
      lineItems: [{ name: "Mug", amount: 1000, quantity: 1 }],
      shippingAmount: 0,
      taxAmount: 0,
      discountAmount: 1000,
      expectedTotal: 0,
    });
    assert.equal(sumStripeLineItems(items), 0);
  });

  it("applies shipping and tax without discount", () => {
    const items = buildStripeLineItems({
      lineItems: [{ name: "Mug", amount: 2000, quantity: 1 }],
      shippingAmount: 400,
      taxAmount: 100,
      discountAmount: 0,
      expectedTotal: 2500,
    });
    assert.equal(sumStripeLineItems(items), 2500);
    assert.ok(items.some((i) => i.name === "Shipping"));
    assert.ok(items.some((i) => i.name === "Tax"));
  });
});
