import { type AuthApiFailure, readAuthFailure } from "./account-validation";
import { setCustomerAccessToken } from "./customer-auth";
import { type AuthMethod, setLastAuthMethod } from "./last-auth-method";

export type AccountOrder = {
  id: string;
  number: number;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
};

export type AccountAddress = {
  id: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string | null;
  city: string;
  postalCode: string;
  country: string;
  state?: string | null;
  phone?: string | null;
  isDefault: boolean;
};

export type AccountCustomer = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  orders?: AccountOrder[];
  addresses?: AccountAddress[];
};

export type AuthStep = "email" | "code";
export type AuthMode = "sign_in" | "sign_up";
export type OAuthProvider = Extract<AuthMethod, "google" | "apple">;

export type AccountLabels = {
  login: string;
  orders: string;
  logout: string;
  noOrders: string;
  email: string;
  continue: string;
  code: string;
  verify: string;
  verifySignUp: string;
  resend: string;
  resendIn: string;
  changeEmail: string;
  google: string;
  apple: string;
  or: string;
  signedInAs: string;
  sendCode: string;
  sendCodeSignUp: string;
  codeSent: string;
  codeSentSignUp: string;
  codeHint: string;
  nameFirst: string;
  nameLast: string;
  saveProfile: string;
  profile: string;
  wishlist: string;
  wishlistEmpty: string;
  wishlistCount: string;
  addresses: string;
  noAddresses: string;
  defaultAddress: string;
  emailReadonly: string;
  continueShopping: string;
  sectionsNav: string;
  errorGeneric: string;
  oauthDenied: string;
  termsBefore: string;
  terms: string;
  termsAnd: string;
  privacy: string;
  termsAfter: string;
  marketingOptIn: string;
  termsRequired: string;
  lead: string;
  leadSignUp: string;
  signIn: string;
  signUp: string;
  lastUsed: string;
  loading: string;
  sendingCode: string;
  verifying: string;
  saving: string;
  redirecting: string;
  errorEmailRequired: string;
  errorEmailInvalid: string;
  errorCodeRequired: string;
  errorCodeInvalid: string;
  errorTurnstile: string;
  errorRateLimit: string;
  errorInvalidCode: string;
  errorNetwork: string;
  errorValidation: string;
  errorNameRequired: string;
  errorAccountNotFound: string;
  errorAccountExists: string;
  switchToSignUp: string;
  switchToSignIn: string;
};

export function formatAddressLines(address: AccountAddress): string[] {
  const lines = [
    `${address.firstName} ${address.lastName}`.trim(),
    address.line1,
    address.line2?.trim() || null,
    [address.postalCode, address.city].filter(Boolean).join(" "),
    [address.state, address.country].filter(Boolean).join(", "),
  ];
  return lines.filter((line): line is string => Boolean(line));
}

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js";
const AUTH_MODE_STORAGE_KEY = "nestpaw:auth-mode";

export function orderedOAuthProviders(
  lastUsed: AuthMethod | null,
): OAuthProvider[] {
  return lastUsed === "apple" ? ["apple", "google"] : ["google", "apple"];
}

export function oauthStartUrl(
  apiUrl: string,
  provider: OAuthProvider,
  locale: string,
) {
  return `${apiUrl}/customers/auth/oauth/${provider}/start?locale=${locale}`;
}

export function sanitizeOtpCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function formatOrderTotal(order: AccountOrder) {
  return `€${((order.total ?? 0) / 100).toFixed(2)} ${order.currency ?? "EUR"}`;
}

export function rememberAuthMethod(method: AuthMethod) {
  setLastAuthMethod(method);
  return method;
}

export function readAuthModeFromUrl(): AuthMode | null {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  if (mode === "sign_up" || mode === "sign_in") return mode;
  return null;
}

export function persistAuthMode(mode: AuthMode) {
  try {
    sessionStorage.setItem(AUTH_MODE_STORAGE_KEY, mode);
  } catch {
    // private mode
  }
}

export function readPersistedAuthMode(): AuthMode | null {
  try {
    const mode = sessionStorage.getItem(AUTH_MODE_STORAGE_KEY);
    if (mode === "sign_up" || mode === "sign_in") return mode;
  } catch {
    // private mode
  }
  return null;
}

export function persistMarketingOptIn(value: boolean) {
  try {
    if (value) sessionStorage.setItem("nestpaw:auth-marketing", "1");
    else sessionStorage.removeItem("nestpaw:auth-marketing");
  } catch {
    // private mode
  }
}

export function consumeMarketingOptIn(): boolean {
  try {
    const value = sessionStorage.getItem("nestpaw:auth-marketing") === "1";
    sessionStorage.removeItem("nestpaw:auth-marketing");
    return value;
  } catch {
    return false;
  }
}

/** Read + clear `?authError=` from the current URL. */
export function consumeAuthErrorMessage(labels: AccountLabels): string | null {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("authError");
  if (!error) return null;
  const next = new URL(window.location.href);
  next.searchParams.delete("authError");
  window.history.replaceState({}, "", `${next.pathname}${next.search}`);
  return error === "oauth_denied" ? labels.oauthDenied : labels.errorGeneric;
}

export function readTurnstileToken(root: ParentNode | null): string {
  const input = root?.querySelector("[name='cf-turnstile-response']");
  return input instanceof HTMLInputElement ? input.value : "";
}

export function ensureTurnstileScript() {
  if (document.getElementById(TURNSTILE_SCRIPT_ID)) return;
  // Reuse a script already present (e.g. newsletter) without injecting a duplicate.
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${TURNSTILE_SCRIPT_SRC}"]`,
  );
  if (existing) {
    existing.id = TURNSTILE_SCRIPT_ID;
    return;
  }
  const script = document.createElement("script");
  script.id = TURNSTILE_SCRIPT_ID;
  script.src = TURNSTILE_SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  document.body.appendChild(script);
}

export async function refreshCustomerSession(apiUrl: string) {
  const res = await fetch(`${apiUrl}/customers/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    accessToken: string | null;
    customer: { email: string } | null;
  };
  if (!data.accessToken) return null;
  setCustomerAccessToken(data.accessToken);
  return data.accessToken;
}

export async function fetchCustomerMe(apiUrl: string, accessToken: string) {
  const res = await fetch(`${apiUrl}/customers/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "include",
  });
  if (!res.ok) {
    setCustomerAccessToken(null);
    return null;
  }
  return (await res.json()) as AccountCustomer;
}

export async function requestCustomerOtp(params: {
  apiUrl: string;
  email: string;
  locale: string;
  turnstileToken: string;
  intent: AuthMode;
}): Promise<{ ok: true } | AuthApiFailure> {
  try {
    const res = await fetch(`${params.apiUrl}/customers/auth/otp/request`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: params.email.trim(),
        locale: params.locale,
        turnstileToken: params.turnstileToken,
        intent: params.intent,
      }),
    });
    if (!res.ok) return readAuthFailure(res);
    return { ok: true };
  } catch {
    return { ok: false, status: 0, kind: "network" };
  }
}

export async function verifyCustomerOtp(params: {
  apiUrl: string;
  email: string;
  code: string;
  locale: string;
  marketingOptIn?: boolean;
}): Promise<{ ok: true; accessToken: string } | AuthApiFailure> {
  try {
    const res = await fetch(`${params.apiUrl}/customers/auth/otp/verify`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: params.email.trim(),
        code: params.code,
        locale: params.locale,
        marketingOptIn: params.marketingOptIn ?? false,
      }),
    });
    if (!res.ok) return readAuthFailure(res);
    const data = (await res.json()) as { accessToken: string };
    setCustomerAccessToken(data.accessToken);
    return { ok: true, accessToken: data.accessToken };
  } catch {
    return { ok: false, status: 0, kind: "network" };
  }
}

export async function logoutCustomer(apiUrl: string) {
  await fetch(`${apiUrl}/customers/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => undefined);
  setCustomerAccessToken(null);
}

export async function updateCustomerProfile(params: {
  apiUrl: string;
  accessToken: string;
  firstName: string;
  lastName: string;
}): Promise<{ ok: true } | AuthApiFailure> {
  try {
    const res = await fetch(`${params.apiUrl}/customers/me`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.accessToken}`,
      },
      body: JSON.stringify({
        firstName: params.firstName.trim(),
        lastName: params.lastName.trim(),
      }),
    });
    if (!res.ok) return readAuthFailure(res);
    return { ok: true };
  } catch {
    return { ok: false, status: 0, kind: "network" };
  }
}

export async function optInCustomerNewsletter(params: {
  apiUrl: string;
  accessToken: string;
  locale: string;
}): Promise<{ ok: true } | AuthApiFailure> {
  try {
    const res = await fetch(`${params.apiUrl}/customers/me/newsletter`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.accessToken}`,
      },
      body: JSON.stringify({ locale: params.locale }),
    });
    if (!res.ok) return readAuthFailure(res);
    return { ok: true };
  } catch {
    return { ok: false, status: 0, kind: "network" };
  }
}
