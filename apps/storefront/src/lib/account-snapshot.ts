import type { AccountOrder } from "./customer-account";

/** Non-secret UI snapshot so the account panel can paint without a skeleton. */
export const ACCOUNT_SNAPSHOT_KEY = "nestpaw-account-snapshot";

export type AccountSnapshot = {
  email: string;
  firstName: string;
  lastName: string;
  orders: AccountOrder[];
};

export function readAccountSnapshot(): AccountSnapshot | null {
  try {
    const raw = sessionStorage.getItem(ACCOUNT_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AccountSnapshot;
    if (!parsed || typeof parsed.email !== "string") return null;
    return {
      email: parsed.email,
      firstName: typeof parsed.firstName === "string" ? parsed.firstName : "",
      lastName: typeof parsed.lastName === "string" ? parsed.lastName : "",
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
    };
  } catch {
    return null;
  }
}

export function writeAccountSnapshot(snapshot: AccountSnapshot) {
  try {
    sessionStorage.setItem(ACCOUNT_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore quota / private mode
  }
}

export function clearAccountSnapshot() {
  try {
    sessionStorage.removeItem(ACCOUNT_SNAPSHOT_KEY);
  } catch {
    // ignore
  }
}
