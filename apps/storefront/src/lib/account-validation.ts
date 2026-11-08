import type { AccountLabels } from "./customer-account";

export type AuthField = "email" | "code" | "terms" | "firstName" | "lastName";

export type FieldErrors = Partial<Record<AuthField, string>>;

export type FormNotice = {
  tone: "error" | "success";
  text: string;
};

export type AuthApiFailure = {
  ok: false;
  status: number;
  kind:
    | "validation"
    | "turnstile"
    | "rate_limit"
    | "invalid_code"
    | "network"
    | "generic";
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string) {
  const email = value.trim();
  return email.length > 0 && email.length <= 320 && EMAIL_RE.test(email);
}

export function isValidOtpCode(value: string) {
  return /^\d{6}$/.test(value);
}

export function isValidName(value: string) {
  const name = value.trim();
  return name.length >= 1 && name.length <= 100;
}

export function validateEmail(
  value: string,
  labels: AccountLabels,
): string | undefined {
  const email = value.trim();
  if (!email) return labels.errorEmailRequired;
  if (!isValidEmail(email)) return labels.errorEmailInvalid;
  return undefined;
}

export function validateOtpCode(
  value: string,
  labels: AccountLabels,
): string | undefined {
  if (!value) return labels.errorCodeRequired;
  if (!isValidOtpCode(value)) return labels.errorCodeInvalid;
  return undefined;
}

export function validateTerms(
  accepted: boolean,
  labels: AccountLabels,
): string | undefined {
  return accepted ? undefined : labels.termsRequired;
}

export function validateName(
  value: string,
  labels: AccountLabels,
): string | undefined {
  return isValidName(value) ? undefined : labels.errorNameRequired;
}

export function validateEmailStep(input: {
  email: string;
  acceptedTerms: boolean;
  turnstileToken: string;
  labels: AccountLabels;
}): { ok: true } | { ok: false; errors: FieldErrors; notice?: FormNotice } {
  const errors: FieldErrors = {};
  const emailError = validateEmail(input.email, input.labels);
  const termsError = validateTerms(input.acceptedTerms, input.labels);
  if (emailError) errors.email = emailError;
  if (termsError) errors.terms = termsError;

  if (!input.turnstileToken) {
    return {
      ok: false,
      errors,
      notice: { tone: "error", text: input.labels.errorTurnstile },
    };
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true };
}

export function validateOtpStep(input: {
  code: string;
  labels: AccountLabels;
}): { ok: true } | { ok: false; errors: FieldErrors } {
  const codeError = validateOtpCode(input.code, input.labels);
  if (codeError) return { ok: false, errors: { code: codeError } };
  return { ok: true };
}

export function validateProfileStep(input: {
  firstName: string;
  lastName: string;
  labels: AccountLabels;
}): { ok: true } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const first = validateName(input.firstName, input.labels);
  const last = validateName(input.lastName, input.labels);
  if (first) errors.firstName = first;
  if (last) errors.lastName = last;
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true };
}

export function firstErrorField(
  errors: FieldErrors,
  order: AuthField[],
): AuthField | null {
  return order.find((field) => errors[field]) ?? null;
}

export function authFailureMessage(
  failure: AuthApiFailure,
  labels: AccountLabels,
): string {
  switch (failure.kind) {
    case "turnstile":
      return labels.errorTurnstile;
    case "rate_limit":
      return labels.errorRateLimit;
    case "invalid_code":
      return labels.errorInvalidCode;
    case "network":
      return labels.errorNetwork;
    case "validation":
      return labels.errorValidation;
    default:
      return labels.errorGeneric;
  }
}

export function classifyAuthStatus(status: number): AuthApiFailure["kind"] {
  if (status === 401) return "invalid_code";
  if (status === 403) return "turnstile";
  if (status === 429) return "rate_limit";
  if (status === 400) return "validation";
  return "generic";
}

export async function readAuthFailure(
  res: Response,
): Promise<AuthApiFailure> {
  return {
    ok: false,
    status: res.status,
    kind: classifyAuthStatus(res.status),
  };
}
