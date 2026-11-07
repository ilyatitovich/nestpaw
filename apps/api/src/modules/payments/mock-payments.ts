const DEFAULT_DEV_SECRETS = new Set([
  "dev-access-secret",
  "change-me-access-secret-min-32-chars!!",
]);

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Mock Stripe checkout is allowed only outside production with an explicit flag (default true in non-prod). */
export function allowMockPayments(): boolean {
  if (isProduction()) return false;
  if (process.env.ALLOW_MOCK_PAYMENTS === "false") return false;
  return process.env.ALLOW_MOCK_PAYMENTS !== "0";
}

export function assertProductionSecrets(): void {
  if (!isProduction()) return;

  const access = process.env.JWT_ACCESS_SECRET;
  if (!access || DEFAULT_DEV_SECRETS.has(access) || access.length < 32) {
    throw new Error(
      "JWT_ACCESS_SECRET must be set to a strong secret (min 32 chars) in production",
    );
  }

  const customer = process.env.JWT_CUSTOMER_SECRET;
  if (
    customer &&
    (DEFAULT_DEV_SECRETS.has(customer) || customer.length < 32)
  ) {
    throw new Error(
      "JWT_CUSTOMER_SECRET must be a strong secret (min 32 chars) when set in production",
    );
  }

  const pepper = process.env.CUSTOMER_OTP_PEPPER;
  if (pepper && (DEFAULT_DEV_SECRETS.has(pepper) || pepper.length < 16)) {
    throw new Error(
      "CUSTOMER_OTP_PEPPER must be a strong secret (min 16 chars) when set in production",
    );
  }
}
