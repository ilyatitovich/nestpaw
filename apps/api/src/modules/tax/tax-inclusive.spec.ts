import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractIncludedTax, unitPriceCents } from "./tax-inclusive.js";

describe("tax-inclusive helpers", () => {
  it("extracts 19% VAT from gross", () => {
    // 119.00 gross → 19.00 VAT
    assert.equal(extractIncludedTax(11900, 1900), 1900);
  });

  it("extracts 7% reduced VAT", () => {
    assert.equal(extractIncludedTax(10700, 700), 700);
  });

  it("computes Grundpreis per kg", () => {
    // €10 for 500g → €20/kg
    assert.equal(unitPriceCents(1000, 500, 1000), 2000);
  });
});
