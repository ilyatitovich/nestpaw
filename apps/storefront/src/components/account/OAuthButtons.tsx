import type { MouseEvent } from "react";
import {
  type OAuthProvider,
  oauthStartUrl,
  orderedOAuthProviders,
} from "@/lib/customer-account";
import type { AuthMethod } from "@/lib/last-auth-method";
import { AppleIcon, GoogleIcon, ShopIcon } from "./OAuthIcons";

type Props = {
  apiUrl: string;
  locale: string;
  lastUsed: AuthMethod | null;
  googleLabel: string;
  appleLabel: string;
  shopLabel: string;
  redirectingLabel: string;
  busy: boolean;
  pendingProvider: OAuthProvider | null;
  onSelect: (e: MouseEvent<HTMLAnchorElement>, provider: OAuthProvider) => void;
  onShopSelect: () => void;
};

const icons = {
  google: GoogleIcon,
  apple: AppleIcon,
} as const;

export default function OAuthButtons({
  apiUrl,
  locale,
  lastUsed,
  googleLabel,
  appleLabel,
  shopLabel,
  redirectingLabel,
  busy,
  pendingProvider,
  onSelect,
  onShopSelect,
}: Props) {
  const labels = { google: googleLabel, apple: appleLabel };

  return (
    <div className="account-oauth" aria-busy={busy || undefined}>
      <button
        type="button"
        className="account-oauth__btn account-oauth__btn--shop"
        disabled={busy}
        onClick={onShopSelect}
      >
        <ShopIcon />
        <span className="account-oauth__label">{shopLabel}</span>
      </button>

      {orderedOAuthProviders(lastUsed).map((provider) => {
        const isPending = pendingProvider === provider;
        const Icon = icons[provider];
        const disabled = busy;
        return (
          <a
            key={provider}
            className={[
              `account-oauth__btn account-oauth__btn--${provider}`,
              isPending ? "is-busy" : "",
              disabled && !isPending ? "is-disabled" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            href={oauthStartUrl(apiUrl, provider, locale)}
            onClick={(e) => {
              if (disabled) {
                e.preventDefault();
                return;
              }
              onSelect(e, provider);
            }}
            aria-disabled={disabled || undefined}
            aria-busy={isPending || undefined}
          >
            <Icon />
            <span className="account-oauth__label">
              {isPending ? redirectingLabel : labels[provider]}
            </span>
          </a>
        );
      })}
    </div>
  );
}
