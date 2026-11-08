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

export type AccountCustomer = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  orders?: AccountOrder[];
};

export type AuthStep = "email" | "code";
export type OAuthProvider = Extract<AuthMethod, "google" | "apple">;

export type AccountLabels = {
  orders: string;
  logout: string;
  noOrders: string;
  email: string;
  continue: string;
  code: string;
  verify: string;
  resend: string;
  resendIn: string;
  google: string;
  apple: string;
  or: string;
  signedInAs: string;
  sendCode: string;
  codeSent: string;
  codeHint: string;
  nameFirst: string;
  nameLast: string;
  saveProfile: string;
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
  lastUsed: string;
};

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js";

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

/** Read + clear `?authError=` from the current URL. */
export function consumeAuthErrorMessage(labels: AccountLabels): string | null {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("authError");
  if (!error) return null;
  window.history.replaceState({}, "", window.location.pathname);
  return error === "oauth_denied" ? labels.oauthDenied : labels.errorGeneric;
}

export function readTurnstileToken(root: ParentNode | null): string {
  const input = root?.querySelector("[name='cf-turnstile-response']");
  return input instanceof HTMLInputElement ? input.value : "";
}

export function resetTurnstile(root: ParentNode | null) {
  const widget = root?.querySelector(".cf-turnstile");
  if (widget instanceof HTMLElement) {
    window.turnstile?.reset(widget);
  }
}

export function ensureTurnstileScript() {
  if (document.getElementById(TURNSTILE_SCRIPT_ID)) return;
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
}) {
  const res = await fetch(`${params.apiUrl}/customers/auth/otp/request`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: params.email,
      locale: params.locale,
      turnstileToken: params.turnstileToken,
    }),
  });
  return res.ok;
}

export async function verifyCustomerOtp(params: {
  apiUrl: string;
  email: string;
  code: string;
}) {
  const res = await fetch(`${params.apiUrl}/customers/auth/otp/verify`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: params.email, code: params.code }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { accessToken: string };
  setCustomerAccessToken(data.accessToken);
  return data.accessToken;
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
}) {
  const res = await fetch(`${params.apiUrl}/customers/me`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      firstName: params.firstName,
      lastName: params.lastName,
    }),
  });
  return res.ok;
}
