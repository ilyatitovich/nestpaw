import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  allowMockPayments,
  assertProductionSecrets,
  isProduction,
} from "./mock-payments.js";

describe("mock-payments", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it("disallows mock payments in production", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_MOCK_PAYMENTS = "true";
    assert.equal(allowMockPayments(), false);
    assert.equal(isProduction(), true);
  });

  it("allows mock payments in development by default", () => {
    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_MOCK_PAYMENTS;
    assert.equal(allowMockPayments(), true);
  });

  it("can disable mock payments outside production", () => {
    process.env.NODE_ENV = "development";
    process.env.ALLOW_MOCK_PAYMENTS = "false";
    assert.equal(allowMockPayments(), false);
  });

  it("rejects default JWT secrets in production", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_ACCESS_SECRET = "dev-access-secret";
    assert.throws(() => assertProductionSecrets());
  });

  it("accepts strong JWT secret in production", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_ACCESS_SECRET = "a".repeat(32);
    assert.doesNotThrow(() => assertProductionSecrets());
  });
});
