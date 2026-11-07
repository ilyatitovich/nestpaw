import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canFulfillDenyPolicy } from "./inventory-ops.js";

describe("canFulfillDenyPolicy", () => {
  it("allows continue policy even when qty is low", () => {
    assert.equal(
      canFulfillDenyPolicy({ quantity: 0, policy: "continue" }, 5),
      true,
    );
  });

  it("rejects deny policy when qty insufficient", () => {
    assert.equal(
      canFulfillDenyPolicy({ quantity: 2, policy: "deny" }, 3),
      false,
    );
  });

  it("allows deny policy when qty sufficient", () => {
    assert.equal(
      canFulfillDenyPolicy({ quantity: 3, policy: "deny" }, 3),
      true,
    );
  });
});
