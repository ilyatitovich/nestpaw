import { type FormEvent, type RefObject, useEffect } from "react";
import type { FieldErrors } from "../../lib/account-validation";
import {
  type AccountLabels,
  sanitizeOtpCode,
} from "../../lib/customer-account";
import FieldError from "./FieldError";

type Props = {
  labels: AccountLabels;
  codeId: string;
  codeHintId: string;
  codeErrorId: string;
  email: string;
  code: string;
  busy: boolean;
  resendIn: number;
  fieldErrors: FieldErrors;
  codeInputRef: RefObject<HTMLInputElement | null>;
  onCodeChange: (value: string) => void;
  onCodeBlur: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
};

export default function OtpVerifyForm({
  labels,
  codeId,
  codeHintId,
  codeErrorId,
  email,
  code,
  busy,
  resendIn,
  fieldErrors,
  codeInputRef,
  onCodeChange,
  onCodeBlur,
  onSubmit,
  onBack,
}: Props) {
  const codeInvalid = Boolean(fieldErrors.code);

  useEffect(() => {
    codeInputRef.current?.focus();
  }, [codeInputRef]);

  return (
    <form
      className="account-form"
      onSubmit={onSubmit}
      method="post"
      noValidate
    >
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
          aria-invalid={codeInvalid || undefined}
          aria-describedby={
            codeInvalid ? `${codeHintId} ${codeErrorId}` : codeHintId
          }
          className="account-otp-input"
        />
        <FieldError id={codeErrorId} message={fieldErrors.code} />
      </div>
      <button
        className="btn btn--primary account-form__submit"
        type="submit"
        disabled={busy}
      >
        {labels.verify}
      </button>
      <button
        type="button"
        className="btn btn--ghost"
        disabled={busy}
        onClick={onBack}
      >
        {resendIn > 0
          ? labels.resendIn.replace("{n}", String(resendIn))
          : labels.resend}
      </button>
    </form>
  );
}
