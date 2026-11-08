export type AccountChromeMode = "guest" | "member";

/** Toggle guest vs full store chrome on the account page. */
export function setAccountChrome(mode: AccountChromeMode) {
  document.documentElement.dataset.accountSession = mode;
  for (const el of document.querySelectorAll<HTMLElement>(
    "[data-account-chrome]",
  )) {
    const show = el.dataset.accountChrome === mode;
    el.hidden = !show;
    if (show) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }
}
