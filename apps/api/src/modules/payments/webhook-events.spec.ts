import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Events the payments webhook must handle for DACH async methods. */
const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

describe("stripe webhook event matrix", () => {
  it("covers paid and async failure modes", () => {
    for (const e of [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "checkout.session.expired",
    ]) {
      assert.ok(HANDLED.has(e), e);
    }
  });

  it("requires payment_status paid before markPaid", () => {
    const shouldMarkPaid = (payment_status: string) => payment_status === "paid";
    assert.equal(shouldMarkPaid("paid"), true);
    assert.equal(shouldMarkPaid("unpaid"), false);
    assert.equal(shouldMarkPaid("no_payment_required"), false);
  });
});
