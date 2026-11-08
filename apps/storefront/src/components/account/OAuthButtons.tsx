import type { MouseEvent } from "react";
import {
  type OAuthProvider,
  oauthStartUrl,
  orderedOAuthProviders,
} from "../../lib/customer-account";
import type { AuthMethod } from "../../lib/last-auth-method";
import LastUsedBadge from "./LastUsedBadge";
import { AppleIcon, GoogleIcon } from "./OAuthIcons";

type Props = {
  apiUrl: string;
  locale: string;
  lastUsed: AuthMethod | null;
  lastUsedLabel: string;
  lastUsedDescribedBy?: string;
  googleLabel: string;
  appleLabel: string;
  redirectingLabel: string;
  busy: boolean;
  pendingProvider: OAuthProvider | null;
  onSelect: (e: MouseEvent<HTMLAnchorElement>, provider: OAuthProvider) => void;
};

const icons = {
  google: GoogleIcon,
  apple: AppleIcon,
} as const;

export default function OAuthButtons({
  apiUrl,
  locale,
  lastUsed,
  lastUsedLabel,
  lastUsedDescribedBy,
  googleLabel,
  appleLabel,
  redirectingLabel,
  busy,
  pendingProvider,
  onSelect,
}: Props) {
  const labels = { google: googleLabel, apple: appleLabel };

  return (
    <div className="account-oauth" aria-busy={busy || undefined}>
      {orderedOAuthProviders(lastUsed).map((provider) => {
        const isLast = lastUsed === provider;
        const isPending = pendingProvider === provider;
        const Icon = icons[provider];
        const disabled = busy;
        return (
          <a
            key={provider}
            className={[
              `account-oauth__btn account-oauth__btn--${provider}`,
              isLast ? "is-last-used" : "",
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
            aria-describedby={isLast ? lastUsedDescribedBy : undefined}
          >
            <Icon />
            <span className="account-oauth__label">
              {isPending ? redirectingLabel : labels[provider]}
            </span>
            {isLast && !isPending ? (
              <LastUsedBadge label={lastUsedLabel} />
            ) : null}
          </a>
        );
      })}
    </div>
  );
}
