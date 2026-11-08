import { isValidEmail, isValidName } from "./account-validation";

export const CHECKOUT_COUNTRIES = ["DE", "AT", "FR", "NL", "BE"] as const;
export type CheckoutCountry = (typeof CHECKOUT_COUNTRIES)[number];

export type CheckoutField =
  | "firstName"
  | "lastName"
  | "email"
  | "line1"
  | "line2"
  | "city"
  | "postalCode"
  | "country"
  | "phone";

export type CheckoutFieldErrors = Partial<Record<CheckoutField, string>>;

export type CheckoutShippingForm = {
  firstName: string;
  lastName: string;
  email: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
};

export type CheckoutValidationLabels = {
  errorRequired: string;
  errorEmailInvalid: string;
  errorNameInvalid: string;
  errorPostalInvalid: string;
  errorCountryInvalid: string;
  errorPhoneInvalid: string;
};

export const CHECKOUT_FIELD_ORDER: CheckoutField[] = [
  "firstName",
  "lastName",
  "email",
  "line1",
  "line2",
  "city",
  "postalCode",
  "country",
  "phone",
];

const POSTAL_RE = /^[A-Za-z0-9][A-Za-z0-9 \-]{1,18}[A-Za-z0-9]$/;
const PHONE_RE = /^\+?[\d\s().\-]{6,30}$/;

export function emptyShippingForm(
  country: CheckoutCountry = "DE",
): CheckoutShippingForm {
  return {
    firstName: "",
    lastName: "",
    email: "",
    line1: "",
    line2: "",
    city: "",
    postalCode: "",
    country,
    phone: "",
  };
}

export function isCheckoutCountry(value: string): value is CheckoutCountry {
  return (CHECKOUT_COUNTRIES as readonly string[]).includes(value);
}

export function validateCheckoutName(
  value: string,
  labels: CheckoutValidationLabels,
): string | undefined {
  const name = value.trim();
  if (!name) return labels.errorRequired;
  if (!isValidName(value)) return labels.errorNameInvalid;
  return undefined;
}

export function validateCheckoutEmail(
  value: string,
  labels: CheckoutValidationLabels,
): string | undefined {
  const email = value.trim();
  if (!email) return labels.errorRequired;
  if (!isValidEmail(email)) return labels.errorEmailInvalid;
  return undefined;
}

export function validateCheckoutRequired(
  value: string,
  labels: CheckoutValidationLabels,
): string | undefined {
  return value.trim() ? undefined : labels.errorRequired;
}

export function validateCheckoutPostal(
  value: string,
  labels: CheckoutValidationLabels,
): string | undefined {
  const postal = value.trim();
  if (!postal) return labels.errorRequired;
  if (postal.length > 20 || !POSTAL_RE.test(postal)) {
    return labels.errorPostalInvalid;
  }
  return undefined;
}

export function validateCheckoutCountry(
  value: string,
  labels: CheckoutValidationLabels,
): string | undefined {
  const country = value.trim().toUpperCase();
  if (!country) return labels.errorRequired;
  if (!isCheckoutCountry(country)) return labels.errorCountryInvalid;
  return undefined;
}

export function validateCheckoutPhone(
  value: string,
  labels: CheckoutValidationLabels,
): string | undefined {
  const phone = value.trim();
  if (!phone) return undefined;
  if (phone.length > 40 || !PHONE_RE.test(phone)) {
    return labels.errorPhoneInvalid;
  }
  return undefined;
}

export function validateCheckoutLine2(
  value: string,
  labels: CheckoutValidationLabels,
): string | undefined {
  if (!value.trim()) return undefined;
  if (value.trim().length > 200) return labels.errorRequired;
  return undefined;
}

export function validateCheckoutField(
  field: CheckoutField,
  value: string,
  labels: CheckoutValidationLabels,
): string | undefined {
  switch (field) {
    case "firstName":
    case "lastName":
      return validateCheckoutName(value, labels);
    case "email":
      return validateCheckoutEmail(value, labels);
    case "line1":
    case "city":
      return validateCheckoutRequired(value, labels);
    case "line2":
      return validateCheckoutLine2(value, labels);
    case "postalCode":
      return validateCheckoutPostal(value, labels);
    case "country":
      return validateCheckoutCountry(value, labels);
    case "phone":
      return validateCheckoutPhone(value, labels);
  }
}

export function validateCheckoutForm(
  form: CheckoutShippingForm,
  labels: CheckoutValidationLabels,
): { ok: true } | { ok: false; errors: CheckoutFieldErrors } {
  const errors: CheckoutFieldErrors = {};
  for (const field of CHECKOUT_FIELD_ORDER) {
    const error = validateCheckoutField(field, form[field], labels);
    if (error) errors[field] = error;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true };
}

export function firstCheckoutErrorField(
  errors: CheckoutFieldErrors,
): CheckoutField | null {
  return CHECKOUT_FIELD_ORDER.find((field) => errors[field]) ?? null;
}

export function toShippingAddressPayload(form: CheckoutShippingForm) {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    line1: form.line1.trim(),
    line2: form.line2.trim() || undefined,
    city: form.city.trim(),
    postalCode: form.postalCode.trim(),
    country: form.country.trim().toUpperCase(),
    phone: form.phone.trim() || undefined,
  };
}
