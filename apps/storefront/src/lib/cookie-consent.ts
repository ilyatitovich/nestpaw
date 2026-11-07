export const COOKIE_CONSENT_KEY = "nestpaw-cookie-consent";
export const COOKIE_CONSENT_ACCEPTED = "accepted";
export const COOKIE_CONSENT_REJECTED = "rejected";

export type CookieConsentChoice =
  | typeof COOKIE_CONSENT_ACCEPTED
  | typeof COOKIE_CONSENT_REJECTED;
