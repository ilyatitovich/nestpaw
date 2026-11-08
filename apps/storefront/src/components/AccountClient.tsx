import { useEffect, useId, useRef, useState } from "react";
import {
  readAccountSessionHint,
  setAccountChrome,
} from "../lib/account-chrome";
import {
  readAccountSnapshot,
  writeAccountSnapshot,
} from "../lib/account-snapshot";
import {
  type AuthField,
  type FieldErrors,
  type FormNotice,
  authFailureMessage,
  firstErrorField,
  validateEmail,
  validateEmailStep,
  validateName,
  validateOtpCode,
  validateOtpStep,
  validateProfileStep,
  validateTerms,
} from "../lib/account-validation";
import {
  type AccountLabels,
  type AccountOrder,
  type AuthStep,
  type OAuthProvider,
  consumeAuthErrorMessage,
  fetchCustomerMe,
  logoutCustomer,
  refreshCustomerSession,
  rememberAuthMethod,
  requestCustomerOtp,
  updateCustomerProfile,
  verifyCustomerOtp,
} from "../lib/customer-account";
import { getCustomerAccessToken } from "../lib/customer-auth";
import {
  type AuthMethod,
  getLastAuthMethod,
} from "../lib/last-auth-method";
import AccountMessage from "./account/AccountMessage";
import EmailSignInForm from "./account/EmailSignInForm";
import OAuthButtons from "./account/OAuthButtons";
import OtpVerifyForm from "./account/OtpVerifyForm";
import SignedInPanel from "./account/SignedInPanel";
import type { TurnstileApi } from "./account/TurnstileWidget";

function readOptimisticSession(): {
  sessionStatus: "guest" | "member";
  email: string | null;
  firstName: string;
  lastName: string;
  needsName: boolean;
  orders: AccountOrder[];
} {
  if (readAccountSessionHint() === "member") {
    const snap = readAccountSnapshot();
    return {
      sessionStatus: "member",
      email: snap?.email ?? null,
      firstName: snap?.firstName ?? "",
      lastName: snap?.lastName ?? "",
      needsName: snap
        ? !snap.firstName || !snap.lastName
        : false,
      orders: snap?.orders ?? [],
    };
  }
  return {
    sessionStatus: "guest",
    email: null,
    firstName: "",
    lastName: "",
    needsName: false,
    orders: [],
  };
}

type Props = {
  apiUrl: string;
  locale: string;
  turnstileSiteKey: string;
  termsHref: string;
  privacyHref: string;
  labels: AccountLabels;
};

const EMAIL_FOCUS_ORDER: AuthField[] = ["email", "terms"];
const OTP_FOCUS_ORDER: AuthField[] = ["code"];
const PROFILE_FOCUS_ORDER: AuthField[] = ["firstName", "lastName"];

function focusField(id: string) {
  document.getElementById(id)?.focus();
}

export default function AccountClient({
  apiUrl,
  locale,
  turnstileSiteKey,
  termsHref,
  privacyHref,
  labels,
}: Props) {
  const baseId = useId();
  const emailId = `${baseId}-email`;
  const codeId = `${baseId}-code`;
  const termsId = `${baseId}-terms`;
  const marketingId = `${baseId}-marketing`;
  const codeHintId = `${baseId}-code-hint`;
  const noticeId = `${baseId}-notice`;
  const lastUsedDescribedBy = `${baseId}-last-used`;
  const emailErrorId = `${baseId}-email-error`;
  const termsErrorId = `${baseId}-terms-error`;
  const codeErrorId = `${baseId}-code-error`;
  const firstNameId = `${baseId}-first`;
  const lastNameId = `${baseId}-last`;
  const firstNameErrorId = `${baseId}-first-error`;
  const lastNameErrorId = `${baseId}-last-error`;

  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [notice, setNotice] = useState<FormNotice | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [initialSession] = useState(readOptimisticSession);
  const [sessionStatus, setSessionStatus] = useState<"guest" | "member">(
    initialSession.sessionStatus,
  );
  const [token, setToken] = useState<string | null>(null);
  const [orders, setOrders] = useState<AccountOrder[]>(initialSession.orders);
  const [customerEmail, setCustomerEmail] = useState<string | null>(
    initialSession.email,
  );
  const [firstName, setFirstName] = useState(initialSession.firstName);
  const [lastName, setLastName] = useState(initialSession.lastName);
  const [needsName, setNeedsName] = useState(initialSession.needsName);
  const [resendIn, setResendIn] = useState(0);
  const [lastUsed, setLastUsed] = useState<AuthMethod | null>(null);
  const turnstileApiRef = useRef<TurnstileApi | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLastUsed(getLastAuthMethod());
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only session restore
  useEffect(() => {
    const authError = consumeAuthErrorMessage(labels);
    if (authError) setNotice({ tone: "error", text: authError });

    let cancelled = false;
    void (async () => {
      try {
        const accessToken = await refreshCustomerSession(apiUrl);
        if (cancelled) return;
        if (accessToken) {
          const ok = await applyCustomer(accessToken);
          if (!cancelled) {
            setSessionStatus(ok ? "member" : "guest");
          }
          return;
        }
      } catch {
        // stay signed out
      }
      if (!cancelled) setSessionStatus("guest");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setAccountChrome(sessionStatus);
  }, [sessionStatus]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  async function applyCustomer(accessToken: string) {
    const customer = await fetchCustomerMe(apiUrl, accessToken);
    if (!customer) {
      setToken(null);
      return false;
    }
    const nextOrders = customer.orders ?? [];
    const nextFirst = customer.firstName ?? "";
    const nextLast = customer.lastName ?? "";
    setToken(accessToken);
    setCustomerEmail(customer.email);
    setOrders(nextOrders);
    setFirstName(nextFirst);
    setLastName(nextLast);
    setNeedsName(!customer.firstName || !customer.lastName);
    writeAccountSnapshot({
      email: customer.email,
      firstName: nextFirst,
      lastName: nextLast,
      orders: nextOrders,
    });
    return true;
  }

  function remember(method: AuthMethod) {
    setLastUsed(rememberAuthMethod(method));
  }

  function clearFieldError(field: AuthField) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function focusFirstError(errors: FieldErrors, order: AuthField[]) {
    const field = firstErrorField(errors, order);
    if (!field) return;
    const ids: Record<AuthField, string> = {
      email: emailId,
      terms: termsId,
      code: codeId,
      firstName: firstNameId,
      lastName: lastNameId,
    };
    focusField(ids[field]);
  }

  function onOAuthSelect(
    e: React.MouseEvent<HTMLAnchorElement>,
    provider: OAuthProvider,
  ) {
    const termsError = validateTerms(acceptedTerms, labels);
    if (termsError) {
      e.preventDefault();
      const errors = { terms: termsError };
      setFieldErrors(errors);
      setNotice({ tone: "error", text: termsError });
      focusField(termsId);
      return;
    }
    clearFieldError("terms");
    setNotice(null);
    remember(provider);
  }

  async function onRequestOtp(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    const turnstileToken = turnstileApiRef.current?.getToken() ?? "";
    const result = validateEmailStep({
      email,
      acceptedTerms,
      turnstileToken,
      labels,
    });
    if (!result.ok) {
      setFieldErrors(result.errors);
      if (result.notice) setNotice(result.notice);
      focusFirstError(result.errors, EMAIL_FOCUS_ORDER);
      return;
    }

    setFieldErrors({});
    setBusy(true);
    try {
      const response = await requestCustomerOtp({
        apiUrl,
        email,
        locale,
        turnstileToken,
      });
      if (!response.ok) {
        setNotice({
          tone: "error",
          text: authFailureMessage(response, labels),
        });
        turnstileApiRef.current?.reset();
        return;
      }
      setStep("code");
      setResendIn(60);
      setNotice({ tone: "success", text: labels.codeSent });
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyOtp(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    const result = validateOtpStep({ code, labels });
    if (!result.ok) {
      setFieldErrors(result.errors);
      focusFirstError(result.errors, OTP_FOCUS_ORDER);
      return;
    }

    setFieldErrors({});
    setBusy(true);
    try {
      const response = await verifyCustomerOtp({ apiUrl, email, code });
      if (!response.ok) {
        setFieldErrors(
          response.kind === "invalid_code"
            ? { code: labels.errorInvalidCode }
            : {},
        );
        setNotice({
          tone: "error",
          text: authFailureMessage(response, labels),
        });
        if (response.kind === "invalid_code") focusField(codeId);
        return;
      }
      remember("email");
      setNotice(null);
      const ok = await applyCustomer(response.accessToken);
      setSessionStatus(ok ? "member" : "guest");
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await logoutCustomer(apiUrl);
    setToken(null);
    setOrders([]);
    setCustomerEmail(null);
    setStep("email");
    setCode("");
    setAcceptedTerms(false);
    setMarketingOptIn(false);
    setFieldErrors({});
    setNotice(null);
    setSessionStatus("guest");
  }

  async function onSaveProfile(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    const result = validateProfileStep({ firstName, lastName, labels });
    if (!result.ok) {
      setFieldErrors(result.errors);
      focusFirstError(result.errors, PROFILE_FOCUS_ORDER);
      return;
    }

    const access = getCustomerAccessToken();
    if (!access) return;
    setFieldErrors({});
    setBusy(true);
    try {
      const response = await updateCustomerProfile({
        apiUrl,
        accessToken: access,
        firstName,
        lastName,
      });
      if (!response.ok) {
        setNotice({
          tone: "error",
          text: authFailureMessage(response, labels),
        });
        return;
      }
      setNeedsName(false);
    } finally {
      setBusy(false);
    }
  }

  if (sessionStatus === "member") {
    return (
      <SignedInPanel
        labels={labels}
        customerEmail={customerEmail}
        orders={orders}
        needsName={needsName}
        firstName={firstName}
        lastName={lastName}
        firstNameId={firstNameId}
        lastNameId={lastNameId}
        firstNameErrorId={firstNameErrorId}
        lastNameErrorId={lastNameErrorId}
        busy={busy}
        notice={notice}
        fieldErrors={fieldErrors}
        onFirstNameChange={(value) => {
          setFirstName(value);
          clearFieldError("firstName");
        }}
        onLastNameChange={(value) => {
          setLastName(value);
          clearFieldError("lastName");
        }}
        onFirstNameBlur={() => {
          const error = validateName(firstName, labels);
          setFieldErrors((prev) =>
            error
              ? { ...prev, firstName: error }
              : (() => {
                  const next = { ...prev };
                  delete next.firstName;
                  return next;
                })(),
          );
        }}
        onLastNameBlur={() => {
          const error = validateName(lastName, labels);
          setFieldErrors((prev) =>
            error
              ? { ...prev, lastName: error }
              : (() => {
                  const next = { ...prev };
                  delete next.lastName;
                  return next;
                })(),
          );
        }}
        onSaveProfile={onSaveProfile}
        onLogout={onLogout}
      />
    );
  }

  const preferEmail = lastUsed === "email";
  const oauth = (
    <OAuthButtons
      apiUrl={apiUrl}
      locale={locale}
      lastUsed={lastUsed}
      lastUsedLabel={labels.lastUsed}
      lastUsedDescribedBy={lastUsedDescribedBy}
      googleLabel={labels.google}
      appleLabel={labels.apple}
      onSelect={onOAuthSelect}
    />
  );
  const emailForm = (
    <EmailSignInForm
      labels={labels}
      emailId={emailId}
      termsId={termsId}
      marketingId={marketingId}
      emailErrorId={emailErrorId}
      termsErrorId={termsErrorId}
      email={email}
      acceptedTerms={acceptedTerms}
      marketingOptIn={marketingOptIn}
      preferEmail={preferEmail}
      busy={busy}
      fieldErrors={fieldErrors}
      termsHref={termsHref}
      privacyHref={privacyHref}
      turnstileSiteKey={turnstileSiteKey}
      turnstileApiRef={turnstileApiRef}
      onEmailChange={(value) => {
        setEmail(value);
        clearFieldError("email");
      }}
      onEmailBlur={() => {
        const error = validateEmail(email, labels);
        setFieldErrors((prev) =>
          error
            ? { ...prev, email: error }
            : (() => {
                const next = { ...prev };
                delete next.email;
                return next;
              })(),
        );
      }}
      onAcceptedTermsChange={(value) => {
        setAcceptedTerms(value);
        if (value) {
          clearFieldError("terms");
          if (notice?.text === labels.termsRequired) setNotice(null);
        }
      }}
      onMarketingOptInChange={setMarketingOptIn}
      onSubmit={onRequestOtp}
    />
  );
  const divider = (
    <p className="account-divider">
      <span>{labels.or}</span>
    </p>
  );

  return (
    <div className="account-panel">
      <p className="account-panel__lead">{labels.lead}</p>

      {lastUsed ? (
        <span id={lastUsedDescribedBy} className="visually-hidden">
          {labels.lastUsed}
        </span>
      ) : null}

      {step === "email" ? (
        preferEmail ? (
          <>
            {emailForm}
            {divider}
            {oauth}
          </>
        ) : (
          <>
            {oauth}
            {divider}
            {emailForm}
          </>
        )
      ) : (
        <OtpVerifyForm
          labels={labels}
          codeId={codeId}
          codeHintId={codeHintId}
          codeErrorId={codeErrorId}
          email={email}
          code={code}
          busy={busy}
          resendIn={resendIn}
          fieldErrors={fieldErrors}
          codeInputRef={codeInputRef}
          onCodeChange={(value) => {
            setCode(value);
            clearFieldError("code");
            if (notice?.tone === "error") setNotice(null);
          }}
          onCodeBlur={() => {
            const error = validateOtpCode(code, labels);
            setFieldErrors((prev) =>
              error
                ? { ...prev, code: error }
                : (() => {
                    const next = { ...prev };
                    delete next.code;
                    return next;
                  })(),
            );
          }}
          onSubmit={onVerifyOtp}
          onBack={() => {
            setStep("email");
            setCode("");
            setFieldErrors({});
            setNotice(null);
          }}
        />
      )}

      <AccountMessage id={noticeId} notice={notice} />
    </div>
  );
}
