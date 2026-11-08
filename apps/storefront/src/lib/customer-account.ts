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
export type OAuthProvider = Extract<AuthMethod, "google" | "apple">;
export type PendingAuth = {
  email: string;
  marketingOptIn: boolean;
};
export const ACCOUNT_TABS = [
  "orders",
  "profile",
  "wishlist",
  "addresses",
] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];
export const DEFAULT_ACCOUNT_TAB: AccountTab = "orders";

export type AccountLabels = {
  login: string;
  orders: string;
  logout: string;
  noOrders: string;
  email: string;
  continue: string;
  code: string;
  enterCode: string;
  verify: string;
  resend: string;
  resendIn: string;
  changeEmail: string;
  codeSentTo: string;
  change: string;
  google: string;
  apple: string;
  shop: string;
  shopUnavailable: string;
  or: string;
  signedInAs: string;
  sendCode: string;
  codeSent: string;
  nameFirst: string;
  nameLast: string;
  saveProfile: string;
  profile: string;
  wishlist: string;
  wishlistEmpty: string;
  wishlistCount: string;
  wishlistLoading: string;
  wishlistError: string;
  productFrom: string;
  productSale: string;
  productAdd: string;
  productWishlist: string;
  productWishlistAdded: string;
  productAddError: string;
  addresses: string;
  noAddresses: string;
  defaultAddress: string;
  emailReadonly: string;
  continueShopping: string;
  sectionsNav: string;
  errorGeneric: string;
  oauthDenied: string;
  termsAgreeBefore: string;
  terms: string;
  termsAgreeAfter: string;
  privacy: string;
  marketingOptIn: string;
  lead: string;
  signIn: string;
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
  errorNameInvalid: string;
  errorAccountNotFound: string;
  errorAccountExists: string;
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
const PENDING_AUTH_STORAGE_KEY = "nestpaw:pending-auth";

export function orderedOAuthProviders(
  lastUsed: AuthMethod | null,
): OAuthProvider[] {
  return lastUsed === "apple" ? ["apple", "google"] : ["google", "apple"];
}

export function readAuthStepFromUrl(): AuthStep {
  const step = new URLSearchParams(window.location.search).get("step");
  return step === "code" ? "code" : "email";
}

export function writeAuthStepToUrl(
  step: AuthStep,
  historyMode: "replace" | "push" = "replace",
) {
  const next = new URL(window.location.href);
  if (step === "email") next.searchParams.delete("step");
  else next.searchParams.set("step", "code");
  const url = `${next.pathname}${next.search}`;
  const state = { ...(window.history.state ?? {}), authStep: step };
  if (historyMode === "push") window.history.pushState(state, "", url);
  else window.history.replaceState(state, "", url);
}

export function persistPendingAuth(pending: PendingAuth) {
  try {
    sessionStorage.setItem(
      PENDING_AUTH_STORAGE_KEY,
      JSON.stringify({
        email: pending.email.trim(),
        marketingOptIn: pending.marketingOptIn,
      }),
    );
  } catch {
    // private mode
  }
}

export function readPendingAuth(): PendingAuth | null {
  try {
    const raw = sessionStorage.getItem(PENDING_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingAuth>;
    if (typeof parsed.email !== "string" || !parsed.email.trim()) return null;
    return {
      email: parsed.email.trim(),
      marketingOptIn: Boolean(parsed.marketingOptIn),
    };
  } catch {
    return null;
  }
}

export function clearPendingAuth() {
  try {
    sessionStorage.removeItem(PENDING_AUTH_STORAGE_KEY);
  } catch {
    // private mode
  }
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

export function isAccountTab(
  value: string | null | undefined,
): value is AccountTab {
  return Boolean(value && (ACCOUNT_TABS as readonly string[]).includes(value));
}

export function readAccountTabFromUrl(): AccountTab | null {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return isAccountTab(tab) ? tab : null;
}

export function writeAccountTabToUrl(
  tab: AccountTab,
  historyMode: "replace" | "push" = "replace",
) {
  const next = new URL(window.location.href);
  if (tab === DEFAULT_ACCOUNT_TAB) next.searchParams.delete("tab");
  else next.searchParams.set("tab", tab);
  const url = `${next.pathname}${next.search}`;
  if (historyMode === "push") window.history.pushState({}, "", url);
  else window.history.replaceState({}, "", url);
}

export function clearAccountTabFromUrl() {
  const next = new URL(window.location.href);
  if (!next.searchParams.has("tab")) return;
  next.searchParams.delete("tab");
  window.history.replaceState({}, "", `${next.pathname}${next.search}`);
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
