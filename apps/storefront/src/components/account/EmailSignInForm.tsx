import type { FormEvent, RefObject } from "react";
import type { AccountLabels } from "../../lib/customer-account";
import LastUsedBadge from "./LastUsedBadge";

type Props = {
  labels: AccountLabels;
  emailId: string;
  termsId: string;
  marketingId: string;
  messageId: string;
  email: string;
  acceptedTerms: boolean;
  marketingOptIn: boolean;
  preferEmail: boolean;
  busy: boolean;
  message: string | null;
  termsHref: string;
  privacyHref: string;
  turnstileSiteKey: string;
  turnstileRef: RefObject<HTMLDivElement | null>;
  onEmailChange: (value: string) => void;
  onAcceptedTermsChange: (value: boolean) => void;
  onMarketingOptInChange: (value: boolean) => void;
  onClearTermsMessage: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
};

export default function EmailSignInForm({
  labels,
  emailId,
  termsId,
  marketingId,
  messageId,
  email,
  acceptedTerms,
  marketingOptIn,
  preferEmail,
  busy,
  message,
  termsHref,
  privacyHref,
  turnstileSiteKey,
  turnstileRef,
  onEmailChange,
  onAcceptedTermsChange,
  onMarketingOptInChange,
  onClearTermsMessage,
  onSubmit,
}: Props) {
  return (
    <form
      className={preferEmail ? "account-form is-last-used" : "account-form"}
      onSubmit={onSubmit}
      method="post"
    >
      {preferEmail ? (
        <div className="account-form__last-used">
          <LastUsedBadge label={labels.lastUsed} />
        </div>
      ) : null}

      <div className="account-field">
        <label htmlFor={emailId}>{labels.email}</label>
        <input
          id={emailId}
          name="email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          autoComplete="email"
          enterKeyHint="next"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={message ? messageId : undefined}
        />
      </div>

      <fieldset className="account-consents">
        <legend className="visually-hidden">{labels.terms}</legend>
        <label className="account-check" htmlFor={termsId}>
          <input
            id={termsId}
            name="terms"
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => {
              onAcceptedTermsChange(e.target.checked);
              if (e.target.checked) onClearTermsMessage();
            }}
            required
          />
          <span>
            {labels.termsBefore}
            <a href={termsHref} target="_blank" rel="noopener noreferrer">
              {labels.terms}
            </a>
            {labels.termsAnd}
            <a href={privacyHref} target="_blank" rel="noopener noreferrer">
              {labels.privacy}
            </a>
            {labels.termsAfter}
          </span>
        </label>
        <label className="account-check" htmlFor={marketingId}>
          <input
            id={marketingId}
            name="marketing"
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => onMarketingOptInChange(e.target.checked)}
          />
          <span>{labels.marketingOptIn}</span>
        </label>
      </fieldset>

      <div ref={turnstileRef} className="account-turnstile">
        <div
          className="cf-turnstile"
          data-sitekey={turnstileSiteKey}
          data-theme="light"
          data-size="flexible"
        />
      </div>

      <button
        className="btn btn--primary account-form__submit"
        type="submit"
        disabled={busy}
      >
        {labels.sendCode}
      </button>
    </form>
  );
}
