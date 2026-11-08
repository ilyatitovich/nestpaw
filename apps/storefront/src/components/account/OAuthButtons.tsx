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
  onSelect,
}: Props) {
  const labels = { google: googleLabel, apple: appleLabel };

  return (
    <div className="account-oauth">
      {orderedOAuthProviders(lastUsed).map((provider) => {
        const isLast = lastUsed === provider;
        const Icon = icons[provider];
        return (
          <a
            key={provider}
            className={
              isLast
                ? `account-oauth__btn account-oauth__btn--${provider} is-last-used`
                : `account-oauth__btn account-oauth__btn--${provider}`
            }
            href={oauthStartUrl(apiUrl, provider, locale)}
            onClick={(e) => onSelect(e, provider)}
            aria-describedby={
              isLast ? lastUsedDescribedBy : undefined
            }
          >
            <Icon />
            <span className="account-oauth__label">{labels[provider]}</span>
            {isLast ? <LastUsedBadge label={lastUsedLabel} /> : null}
          </a>
        );
      })}
    </div>
  );
}
