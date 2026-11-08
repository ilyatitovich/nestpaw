import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canFulfillDenyPolicy } from "./inventory-ops.js";

/**
 * Documents the money-path invariants that markPaid must uphold.
 * Full DB integration runs via e2e smoke (mock pay) in CI.
 */
describe("markPaid invariants", () => {
  it("deny policy blocks oversell before claim", () => {
    assert.equal(
      canFulfillDenyPolicy({ quantity: 1, policy: "deny" }, 2),
      false,
    );
    assert.equal(
      canFulfillDenyPolicy({ quantity: 2, policy: "deny" }, 2),
      true,
    );
  });

  it("continue policy allows negative stock path", () => {
    assert.equal(
      canFulfillDenyPolicy({ quantity: 0, policy: "continue" }, 5),
      true,
    );
  });
});
