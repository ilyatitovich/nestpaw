import { type FormEvent, type RefObject, useEffect } from "react";
import type { FieldErrors } from "../../lib/account-validation";
import {
  type AccountLabels,
  type AuthMode,
  sanitizeOtpCode,
} from "../../lib/customer-account";
import FieldError from "./FieldError";
import TurnstileWidget, { type TurnstileApi } from "./TurnstileWidget";

type Props = {
  labels: AccountLabels;
  authMode: AuthMode;
  codeId: string;
  codeHintId: string;
  codeErrorId: string;
  email: string;
  code: string;
  busy: boolean;
  resendIn: number;
  fieldErrors: FieldErrors;
  codeInputRef: RefObject<HTMLInputElement | null>;
  turnstileSiteKey: string;
  turnstileApiRef: RefObject<TurnstileApi | null>;
  onCodeChange: (value: string) => void;
  onCodeBlur: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onResend: () => void;
  onBack: () => void;
};

export default function OtpVerifyForm({
  labels,
  authMode,
  codeId,
  codeHintId,
  codeErrorId,
  email,
  code,
  busy,
  resendIn,
  fieldErrors,
  codeInputRef,
  turnstileSiteKey,
  turnstileApiRef,
  onCodeChange,
  onCodeBlur,
  onSubmit,
  onResend,
  onBack,
}: Props) {
  const codeInvalid = Boolean(fieldErrors.code);
  const verifyLabel =
    authMode === "sign_up" ? labels.verifySignUp : labels.verify;
  const resendDisabled = busy || resendIn > 0;

  useEffect(() => {
    codeInputRef.current?.focus();
  }, [codeInputRef]);

  return (
    <form className="account-form" onSubmit={onSubmit} method="post" noValidate>
      <div className="account-field">
        <label htmlFor={codeId}>{labels.code}</label>
        <p id={codeHintId} className="account-field__hint">
          {labels.codeHint.replace("{email}", email)}
        </p>
        <input
          ref={codeInputRef}
          id={codeId}
          name="otp"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(e) => onCodeChange(sanitizeOtpCode(e.target.value))}
          onBlur={onCodeBlur}
          required
          autoComplete="one-time-code"
          enterKeyHint="done"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={busy}
          aria-invalid={codeInvalid || undefined}
          aria-describedby={
            codeInvalid ? `${codeHintId} ${codeErrorId}` : codeHintId
          }
          className="account-otp-input"
        />
        <FieldError id={codeErrorId} message={fieldErrors.code} />
      </div>

      <TurnstileWidget siteKey={turnstileSiteKey} apiRef={turnstileApiRef} />

      <button
        className="btn btn--primary account-form__submit"
        type="submit"
        disabled={busy}
        aria-busy={busy || undefined}
      >
        {busy ? labels.verifying : verifyLabel}
      </button>
      <button
        type="button"
        className="btn btn--ghost"
        disabled={resendDisabled}
        aria-busy={busy || undefined}
        onClick={onResend}
      >
        {resendIn > 0
          ? labels.resendIn.replace("{n}", String(resendIn))
          : labels.resend}
      </button>
      <button
        type="button"
        className="btn btn--ghost account-form__change-email"
        disabled={busy}
        onClick={onBack}
      >
        {labels.changeEmail}
      </button>
    </form>
  );
}
