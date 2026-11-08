import type { FormEvent, RefObject } from "react";
import type { FieldErrors } from "../../lib/account-validation";
import type { AccountLabels } from "../../lib/customer-account";
import FieldError from "./FieldError";
import LastUsedBadge from "./LastUsedBadge";
import TurnstileWidget, { type TurnstileApi } from "./TurnstileWidget";

type Props = {
  labels: AccountLabels;
  emailId: string;
  marketingId: string;
  emailErrorId: string;
  email: string;
  marketingOptIn: boolean;
  preferEmail: boolean;
  busy: boolean;
  fieldErrors: FieldErrors;
  termsHref: string;
  turnstileSiteKey: string;
  turnstileApiRef: RefObject<TurnstileApi | null>;
  onEmailChange: (value: string) => void;
  onEmailBlur: () => void;
  onMarketingOptInChange: (value: boolean) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
};

export default function EmailSignInForm({
  labels,
  emailId,
  marketingId,
  emailErrorId,
  email,
  marketingOptIn,
  preferEmail,
  busy,
  fieldErrors,
  termsHref,
  turnstileSiteKey,
  turnstileApiRef,
  onEmailChange,
  onEmailBlur,
  onMarketingOptInChange,
  onSubmit,
}: Props) {
  const emailInvalid = Boolean(fieldErrors.email);

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

      <div className="account-field account-field--email-submit">
        <label className="visually-hidden" htmlFor={emailId}>
          {labels.email}
        </label>
        <div className="account-email-submit">
          <input
            id={emailId}
            name="email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            onBlur={onEmailBlur}
            required
            placeholder={labels.email}
            autoComplete="username"
            enterKeyHint="send"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
            aria-invalid={emailInvalid || undefined}
            aria-describedby={emailInvalid ? emailErrorId : undefined}
          />
          <button
            className="account-email-submit__btn"
            type="submit"
            disabled={busy}
            aria-busy={busy || undefined}
            aria-label={busy ? labels.sendingCode : labels.sendCode}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
        <FieldError id={emailErrorId} message={fieldErrors.email} />
      </div>

      <label className="account-check" htmlFor={marketingId}>
        <input
          id={marketingId}
          name="marketing"
          type="checkbox"
          checked={marketingOptIn}
          disabled={busy}
          onChange={(e) => onMarketingOptInChange(e.target.checked)}
        />
        <span>{labels.marketingOptIn}</span>
      </label>

      <p className="account-legal-agree">
        {labels.termsAgreeBefore}
        <a href={termsHref} target="_blank" rel="noopener noreferrer">
          {labels.terms}
        </a>
        {labels.termsAgreeAfter}
      </p>

      <TurnstileWidget siteKey={turnstileSiteKey} apiRef={turnstileApiRef} />
    </form>
  );
}
