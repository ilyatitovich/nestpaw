import type { FormEvent, RefObject } from "react";
import type { FieldErrors } from "../../lib/account-validation";
import type { AccountLabels } from "../../lib/customer-account";
import FieldError from "./FieldError";
import LastUsedBadge from "./LastUsedBadge";
import TurnstileWidget, { type TurnstileApi } from "./TurnstileWidget";

type Props = {
  labels: AccountLabels;
  emailId: string;
  termsId: string;
  marketingId: string;
  emailErrorId: string;
  termsErrorId: string;
  email: string;
  acceptedTerms: boolean;
  marketingOptIn: boolean;
  preferEmail: boolean;
  busy: boolean;
  fieldErrors: FieldErrors;
  termsHref: string;
  privacyHref: string;
  turnstileSiteKey: string;
  turnstileApiRef: RefObject<TurnstileApi | null>;
  onEmailChange: (value: string) => void;
  onEmailBlur: () => void;
  onAcceptedTermsChange: (value: boolean) => void;
  onMarketingOptInChange: (value: boolean) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
};

export default function EmailSignInForm({
  labels,
  emailId,
  termsId,
  marketingId,
  emailErrorId,
  termsErrorId,
  email,
  acceptedTerms,
  marketingOptIn,
  preferEmail,
  busy,
  fieldErrors,
  termsHref,
  privacyHref,
  turnstileSiteKey,
  turnstileApiRef,
  onEmailChange,
  onEmailBlur,
  onAcceptedTermsChange,
  onMarketingOptInChange,
  onSubmit,
}: Props) {
  const emailInvalid = Boolean(fieldErrors.email);
  const termsInvalid = Boolean(fieldErrors.terms);

  return (
    <form
      className={preferEmail ? "account-form is-last-used" : "account-form"}
      onSubmit={onSubmit}
      method="post"
      noValidate
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
          onBlur={onEmailBlur}
          required
          autoComplete="email"
          enterKeyHint="next"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={emailInvalid || undefined}
          aria-describedby={emailInvalid ? emailErrorId : undefined}
        />
        <FieldError id={emailErrorId} message={fieldErrors.email} />
      </div>

      <fieldset
        className={
          termsInvalid ? "account-consents is-invalid" : "account-consents"
        }
      >
        <legend className="visually-hidden">{labels.terms}</legend>
        <label className="account-check" htmlFor={termsId}>
          <input
            id={termsId}
            name="terms"
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => onAcceptedTermsChange(e.target.checked)}
            required
            aria-invalid={termsInvalid || undefined}
            aria-describedby={termsInvalid ? termsErrorId : undefined}
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
        <FieldError id={termsErrorId} message={fieldErrors.terms} />
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

      <TurnstileWidget siteKey={turnstileSiteKey} apiRef={turnstileApiRef} />

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
