import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateOtpCode,
  hashOtpCode,
  normalizeEmail,
  otpIntentMismatch,
  parseTtlDays,
  safeEqualHex,
} from "./customer-auth.util.js";

describe("customer-auth.util", () => {
  it("normalizes email", () => {
    assert.equal(normalizeEmail("  Foo@Example.COM "), "foo@example.com");
  });

  it("gates OTP intent against account existence", () => {
    assert.equal(otpIntentMismatch("sign_in", false), "account_not_found");
    assert.equal(otpIntentMismatch("sign_in", true), null);
    assert.equal(otpIntentMismatch("sign_up", true), "account_exists");
    assert.equal(otpIntentMismatch("sign_up", false), null);
  });

  it("hashes OTP deterministically with pepper", () => {
    process.env.CUSTOMER_OTP_PEPPER = "test-pepper";
    const a = hashOtpCode("a@b.com", "123456");
    const b = hashOtpCode("a@b.com", "123456");
    const c = hashOtpCode("a@b.com", "000000");
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.equal(safeEqualHex(a, b), true);
    assert.equal(safeEqualHex(a, c), false);
  });

  it("generates 6-digit codes", () => {
    for (let i = 0; i < 20; i++) {
      assert.match(generateOtpCode(), /^\d{6}$/);
    }
  });

  it("parses refresh TTL days", () => {
    assert.equal(parseTtlDays("7d", 7), 7);
    assert.equal(parseTtlDays("14d", 7), 14);
    assert.equal(parseTtlDays(undefined, 7), 7);
    assert.equal(parseTtlDays("nope", 7), 7);
  });
});
