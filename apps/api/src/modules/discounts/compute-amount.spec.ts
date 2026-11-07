import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeDiscountAmount } from "./compute-amount";

describe("computeDiscountAmount", () => {
  it("computes percentage discount", () => {
    assert.equal(
      computeDiscountAmount({ type: "percentage", value: 10 }, 10000),
      1000,
    );
  });

  it("caps fixed amount at subtotal", () => {
    assert.equal(
      computeDiscountAmount({ type: "fixed_amount", value: 5000 }, 2000),
      2000,
    );
  });
});
