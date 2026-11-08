import { clearAccountSnapshot } from "./account-snapshot";

export type AccountChromeMode = "guest" | "member";

/** Non-secret hint so account page can paint the right chrome before refresh. */
export const ACCOUNT_SESSION_HINT_KEY = "nestpaw-account-session";

export function readAccountSessionHint(): AccountChromeMode | null {
  try {
    return sessionStorage.getItem(ACCOUNT_SESSION_HINT_KEY) === "member"
      ? "member"
      : null;
  } catch {
    return null;
  }
}

function persistAccountSessionHint(mode: AccountChromeMode) {
  try {
    if (mode === "member") {
      sessionStorage.setItem(ACCOUNT_SESSION_HINT_KEY, "member");
    } else {
      sessionStorage.removeItem(ACCOUNT_SESSION_HINT_KEY);
      clearAccountSnapshot();
    }
  } catch {
    // ignore quota / private mode
  }
}

/** Toggle guest vs full store chrome on the account page. */
export function setAccountChrome(mode: AccountChromeMode) {
  document.documentElement.dataset.accountSession = mode;
  persistAccountSessionHint(mode);
  for (const el of document.querySelectorAll<HTMLElement>(
    "[data-account-chrome]",
  )) {
    const show = el.dataset.accountChrome === mode;
    el.hidden = !show;
    if (show) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }
}
