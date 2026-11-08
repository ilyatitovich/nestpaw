import { BadRequestException } from "@nestjs/common";

/** Success/cancel URLs must share an origin with CORS_ORIGINS (or STOREFRONT_URL). */
export function assertAllowedCheckoutUrl(url: string, label: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException(`Invalid ${label}`);
  }

  const origins = new Set(
    [
      process.env.STOREFRONT_URL,
      ...(process.env.CORS_ORIGINS ?? "").split(","),
    ]
      .map((o) => o?.trim())
      .filter(Boolean)
      .map((o) => {
        try {
          return new URL(o!).origin;
        } catch {
          return null;
        }
      })
      .filter((o): o is string => Boolean(o)),
  );

  if (origins.size === 0) {
    // Dev fallback when env is empty
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(parsed.origin)) {
      return;
    }
  }

  if (!origins.has(parsed.origin)) {
    throw new BadRequestException(`${label} origin is not allowed`);
  }
}
