export const LAST_AUTH_METHOD_KEY = "nestpaw-last-auth-method";

export const AUTH_METHODS = ["google", "apple", "email"] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];

function isAuthMethod(value: string): value is AuthMethod {
  return (AUTH_METHODS as readonly string[]).includes(value);
}

/** Preference only — method enum, never email or tokens. */
export function getLastAuthMethod(): AuthMethod | null {
  try {
    const raw = localStorage.getItem(LAST_AUTH_METHOD_KEY);
    if (!raw || !isAuthMethod(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

export function setLastAuthMethod(method: AuthMethod) {
  try {
    localStorage.setItem(LAST_AUTH_METHOD_KEY, method);
  } catch {
    // ignore quota / private mode
  }
}
