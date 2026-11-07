import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function otpPepper(): string {
  return (
    process.env.CUSTOMER_OTP_PEPPER ||
    process.env.JWT_CUSTOMER_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    "dev-otp-pepper"
  );
}

export function hashOtpCode(emailNormalized: string, code: string): string {
  return createHmac("sha256", otpPepper())
    .update(`${emailNormalized}:${code}`)
    .digest("hex");
}

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function customerJwtSecret(): string {
  return (
    process.env.JWT_CUSTOMER_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    "dev-access-secret"
  );
}

export function parseTtlDays(
  raw: string | undefined,
  fallbackDays: number,
): number {
  if (!raw) return fallbackDays;
  const match = /^(\d+)d$/i.exec(raw.trim());
  if (match) return Number(match[1]);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallbackDays;
}

export function newRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

export function newFamilyId(): string {
  return randomBytes(16).toString("hex");
}

export function storefrontBaseUrl(): string {
  return (process.env.PUBLIC_STORE_URL ?? "http://localhost:4321").replace(
    /\/$/,
    "",
  );
}

export function apiBaseUrl(): string {
  return (process.env.API_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

export function oauthRedirectUri(provider: "google" | "apple"): string {
  const base = (process.env.OAUTH_REDIRECT_BASE ?? apiBaseUrl()).replace(
    /\/$/,
    "",
  );
  return `${base}/customers/auth/oauth/${provider}/callback`;
}
