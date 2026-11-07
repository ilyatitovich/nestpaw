import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hashOtpCode,
  normalizeEmail,
  safeEqualHex,
} from "./customer-auth.util.js";

describe("otp challenge hashing contract", () => {
  it("verification uses the same HMAC input shape as storage", () => {
    process.env.CUSTOMER_OTP_PEPPER = "unit-test-pepper";
    const email = normalizeEmail("Shopper@Nestpaw.example");
    const code = "482910";
    const stored = hashOtpCode(email, code);
    assert.equal(safeEqualHex(stored, hashOtpCode(email, code)), true);
    assert.equal(safeEqualHex(stored, hashOtpCode(email, "000000")), false);
  });
});
