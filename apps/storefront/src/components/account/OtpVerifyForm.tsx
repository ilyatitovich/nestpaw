import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useRef,
} from "react";
import type { FieldErrors } from "@/lib/account-validation";
import {
  type AccountLabels,
  sanitizeOtpCode,
} from "@/lib/customer-account";
import FieldError from "./FieldError";
import TurnstileWidget, { type TurnstileApi } from "./TurnstileWidget";

const OTP_LENGTH = 6;

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
  const resendDisabled = busy || resendIn > 0;
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => code[i] ?? "");

  useEffect(() => {
    const first = digitRefs.current[0];
    if (first) {
      codeInputRef.current = first;
      first.focus();
    }
  }, [codeInputRef]);

  function focusDigit(index: number) {
    const el = digitRefs.current[Math.max(0, Math.min(OTP_LENGTH - 1, index))];
    el?.focus();
    el?.select();
  }

  function setCodeFromDigits(nextDigits: string[]) {
    onCodeChange(sanitizeOtpCode(nextDigits.join("")));
  }

  function onDigitChange(index: number, raw: string) {
    const cleaned = sanitizeOtpCode(raw);
    if (!cleaned) {
      const next = [...digits];
      next[index] = "";
      setCodeFromDigits(next);
      return;
    }

    if (cleaned.length > 1) {
      const next = [...digits];
      const chars = cleaned.slice(0, OTP_LENGTH - index).split("");
      for (let i = 0; i < chars.length; i++) next[index + i] = chars[i];
      setCodeFromDigits(next);
      focusDigit(Math.min(index + chars.length, OTP_LENGTH - 1));
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setCodeFromDigits(next);
    if (index < OTP_LENGTH - 1) focusDigit(index + 1);
  }

  function onDigitKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      setCodeFromDigits(next);
      focusDigit(index - 1);
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusDigit(index - 1);
    }
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      e.preventDefault();
      focusDigit(index + 1);
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = sanitizeOtpCode(e.clipboardData.getData("text"));
    if (!pasted) return;
    e.preventDefault();
    const next = Array.from({ length: OTP_LENGTH }, (_, i) => pasted[i] ?? "");
    setCodeFromDigits(next);
    focusDigit(Math.min(pasted.length, OTP_LENGTH - 1));
  }

  return (
    <form className="account-form" onSubmit={onSubmit} method="post" noValidate>
      <div className="account-otp-step">
        <h2 className="account-otp-step__title" id={codeId}>
          {labels.enterCode}
        </h2>
        <p id={codeHintId} className="account-otp-step__hint">
          <span>{labels.codeSentTo.replace("{email}", email)}</span>{" "}
          <button
            type="button"
            className="account-otp-step__change"
            disabled={busy}
            onClick={onBack}
          >
            {labels.change}
          </button>
        </p>

        <fieldset
          className="account-otp-boxes"
          aria-labelledby={codeId}
          aria-describedby={
            codeInvalid ? `${codeHintId} ${codeErrorId}` : codeHintId
          }
        >
          <legend className="visually-hidden">{labels.code}</legend>
          {digits.map((digit, index) => (
            <input
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed 6 digit slots
              key={index}
              ref={(el) => {
                digitRefs.current[index] = el;
                if (index === 0) codeInputRef.current = el;
              }}
              className="account-otp-box"
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              enterKeyHint="done"
              maxLength={index === 0 ? OTP_LENGTH : 1}
              value={digit}
              disabled={busy}
              aria-label={`${labels.code} ${index + 1}`}
              aria-invalid={codeInvalid || undefined}
              onChange={(e) => onDigitChange(index, e.target.value)}
              onKeyDown={(e) => onDigitKeyDown(index, e)}
              onPaste={onPaste}
              onBlur={index === OTP_LENGTH - 1 ? onCodeBlur : undefined}
            />
          ))}
        </fieldset>
        <FieldError id={codeErrorId} message={fieldErrors.code} />
      </div>

      <TurnstileWidget siteKey={turnstileSiteKey} apiRef={turnstileApiRef} />

      <button
        className="btn btn--primary account-form__submit"
        type="submit"
        disabled={busy}
        aria-busy={busy || undefined}
      >
        {busy ? labels.verifying : labels.verify}
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
    </form>
  );
}
