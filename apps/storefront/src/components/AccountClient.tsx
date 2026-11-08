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
  authFailureMessage,
  authFailureNotice,
  type FieldErrors,
  type FormNotice,
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
  type AccountAddress,
  type AccountLabels,
  type AccountOrder,
  type AuthMode,
  type AuthStep,
  consumeAuthErrorMessage,
  consumeMarketingOptIn,
  fetchCustomerMe,
  logoutCustomer,
  type OAuthProvider,
  optInCustomerNewsletter,
  persistAuthMode,
  persistMarketingOptIn,
  readAuthModeFromUrl,
  readPersistedAuthMode,
  refreshCustomerSession,
  rememberAuthMethod,
  requestCustomerOtp,
  updateCustomerProfile,
  verifyCustomerOtp,
} from "../lib/customer-account";
import { getCustomerAccessToken } from "../lib/customer-auth";
import { type AuthMethod, getLastAuthMethod } from "../lib/last-auth-method";
import { fetchWishlistProducts } from "../lib/wishlist";
import AccountMessage from "./account/AccountMessage";
import EmailSignInForm from "./account/EmailSignInForm";
import OAuthButtons from "./account/OAuthButtons";
import OtpVerifyForm from "./account/OtpVerifyForm";
import SignedInPanel from "./account/SignedInPanel";
import type { TurnstileApi } from "./account/TurnstileWidget";
import type { ProductCardProduct } from "./ProductCard";

function readOptimisticSession(): {
  sessionStatus: "guest" | "member";
  email: string | null;
  firstName: string;
  lastName: string;
  orders: AccountOrder[];
} {
  if (readAccountSessionHint() === "member") {
    const snap = readAccountSnapshot();
    return {
      sessionStatus: "member",
      email: snap?.email ?? null,
      firstName: snap?.firstName ?? "",
      lastName: snap?.lastName ?? "",
      orders: snap?.orders ?? [],
    };
  }
  return {
    sessionStatus: "guest",
    email: null,
    firstName: "",
    lastName: "",
    orders: [],
  };
}

function initialAuthMode(): AuthMode {
  if (typeof window === "undefined") return "sign_in";
  return readAuthModeFromUrl() ?? readPersistedAuthMode() ?? "sign_in";
}

type Props = {
  apiUrl: string;
  locale: string;
  turnstileSiteKey: string;
  termsHref: string;
  privacyHref: string;
  shopHref: string;
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
  shopHref,
  labels,
}: Props) {
  const baseId = useId();
  const emailId = `${baseId}-email`;
  const codeId = `${baseId}-code`;
  const termsId = `${baseId}-terms`;
  const marketingId = `${baseId}-marketing`;
  const codeHintId = `${baseId}-code-hint`;
  const noticeId = `${baseId}-notice`;
  const modeTablistId = `${baseId}-mode`;
  const lastUsedDescribedBy = `${baseId}-last-used`;
  const emailErrorId = `${baseId}-email-error`;
  const termsErrorId = `${baseId}-terms-error`;
  const codeErrorId = `${baseId}-code-error`;
  const firstNameId = `${baseId}-first`;
  const lastNameId = `${baseId}-last`;
  const firstNameErrorId = `${baseId}-first-error`;
  const lastNameErrorId = `${baseId}-last-error`;

  const [step, setStep] = useState<AuthStep>("email");
  const [authMode, setAuthMode] = useState<AuthMode>(initialAuthMode);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [notice, setNotice] = useState<FormNotice | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [oauthPending, setOauthPending] = useState<OAuthProvider | null>(null);
  const [initialSession] = useState(readOptimisticSession);
  const [sessionStatus, setSessionStatus] = useState<"guest" | "member">(
    initialSession.sessionStatus,
  );
  const [, setToken] = useState<string | null>(null);
  const [orders, setOrders] = useState<AccountOrder[]>(initialSession.orders);
  const [customerEmail, setCustomerEmail] = useState<string | null>(
    initialSession.email,
  );
  const [firstName, setFirstName] = useState(initialSession.firstName);
  const [lastName, setLastName] = useState(initialSession.lastName);
  const [addresses, setAddresses] = useState<AccountAddress[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<
    ProductCardProduct[]
  >([]);
  const [wishlistStatus, setWishlistStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [resendIn, setResendIn] = useState(0);
  const [lastUsed, setLastUsed] = useState<AuthMethod | null>(null);
  const turnstileApiRef = useRef<TurnstileApi | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLastUsed(getLastAuthMethod());
  }, []);

  useEffect(() => {
    if (sessionStatus !== "member") {
      setWishlistProducts([]);
      setWishlistStatus("idle");
      return;
    }

    let cancelled = false;
    setWishlistStatus("loading");
    void (async () => {
      try {
        const products = await fetchWishlistProducts({ apiUrl, locale });
        if (cancelled) return;
        setWishlistProducts(products);
        setWishlistStatus("ready");
      } catch {
        if (cancelled) return;
        setWishlistProducts([]);
        setWishlistStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionStatus, apiUrl, locale]);

  useEffect(() => {
    persistAuthMode(authMode);
    const title = document.querySelector(".account-page__title");
    if (!title) return;
    if (sessionStatus === "member") {
      title.textContent = labels.login;
      return;
    }
    title.textContent =
      authMode === "sign_up" ? labels.signUp : labels.signIn;
  }, [
    authMode,
    sessionStatus,
    labels.login,
    labels.signIn,
    labels.signUp,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only session restore
  useEffect(() => {
    const authError = consumeAuthErrorMessage(labels);
    if (authError) setNotice({ tone: "error", text: authError });

    const pendingMarketing = consumeMarketingOptIn();

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
          if (ok && pendingMarketing) {
            void optInCustomerNewsletter({
              apiUrl,
              accessToken,
              locale,
            });
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
    const nextAddresses = customer.addresses ?? [];
    const nextFirst = customer.firstName ?? "";
    const nextLast = customer.lastName ?? "";
    setToken(accessToken);
    setCustomerEmail(customer.email);
    setOrders(nextOrders);
    setAddresses(nextAddresses);
    setFirstName(nextFirst);
    setLastName(nextLast);
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

  function switchAuthMode(mode: AuthMode) {
    setAuthMode(mode);
    setFieldErrors({});
    setNotice(null);
    setAcceptedTerms(false);
    if (mode === "sign_in") setMarketingOptIn(false);
    setStep("email");
    setCode("");
    turnstileApiRef.current?.reset();
    const next = new URL(window.location.href);
    if (mode === "sign_up") next.searchParams.set("mode", "sign_up");
    else next.searchParams.delete("mode");
    window.history.replaceState({}, "", `${next.pathname}${next.search}`);
  }

  function onOAuthSelect(
    e: React.MouseEvent<HTMLAnchorElement>,
    provider: OAuthProvider,
  ) {
    if (busy || oauthPending) {
      e.preventDefault();
      return;
    }
    if (authMode === "sign_up") {
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
      persistMarketingOptIn(marketingOptIn);
    } else {
      persistMarketingOptIn(false);
    }
    setNotice(null);
    setOauthPending(provider);
    setBusy(true);
    remember(provider);
  }

  async function sendOtpCode(): Promise<boolean> {
    const turnstileToken = turnstileApiRef.current?.getToken() ?? "";
    const result = validateEmailStep({
      email,
      acceptedTerms,
      turnstileToken,
      labels,
      requireTerms: authMode === "sign_up",
    });
    if (!result.ok) {
      setFieldErrors(result.errors);
      if (result.notice) setNotice(result.notice);
      focusFirstError(result.errors, EMAIL_FOCUS_ORDER);
      return false;
    }

    setFieldErrors({});
    setBusy(true);
    try {
      const response = await requestCustomerOtp({
        apiUrl,
        email,
        locale,
        turnstileToken,
        intent: authMode,
      });
      if (!response.ok) {
        setNotice(authFailureNotice(response, labels));
        turnstileApiRef.current?.reset();
        return false;
      }
      setStep("code");
      setResendIn(60);
      setNotice({
        tone: "success",
        text: authMode === "sign_up" ? labels.codeSentSignUp : labels.codeSent,
      });
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function onRequestOtp(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    await sendOtpCode();
  }

  async function onResendOtp() {
    if (busy || resendIn > 0) return;
    setNotice(null);
    const turnstileToken = turnstileApiRef.current?.getToken() ?? "";
    if (!turnstileToken) {
      setNotice({ tone: "error", text: labels.errorTurnstile });
      return;
    }
    setBusy(true);
    try {
      const response = await requestCustomerOtp({
        apiUrl,
        email,
        locale,
        turnstileToken,
        intent: authMode,
      });
      if (!response.ok) {
        setNotice(authFailureNotice(response, labels));
        turnstileApiRef.current?.reset();
        return;
      }
      setResendIn(60);
      setNotice({
        tone: "success",
        text: authMode === "sign_up" ? labels.codeSentSignUp : labels.codeSent,
      });
      turnstileApiRef.current?.reset();
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
      const response = await verifyCustomerOtp({
        apiUrl,
        email,
        code,
        locale,
        marketingOptIn: authMode === "sign_up" ? marketingOptIn : false,
      });
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
    setAddresses([]);
    setCustomerEmail(null);
    setFirstName("");
    setLastName("");
    setStep("email");
    setCode("");
    setAcceptedTerms(false);
    setMarketingOptIn(false);
    setFieldErrors({});
    setNotice(null);
    setOauthPending(null);
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
      writeAccountSnapshot({
        email: customerEmail ?? "",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        orders,
      });
    } finally {
      setBusy(false);
    }
  }

  if (sessionStatus === "member") {
    return (
      <SignedInPanel
        labels={labels}
        locale={locale}
        shopHref={shopHref}
        customerEmail={customerEmail}
        orders={orders}
        addresses={addresses}
        wishlistProducts={wishlistProducts}
        wishlistStatus={wishlistStatus}
        apiUrl={apiUrl}
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
        onWishlistChange={(productId, saved) => {
          if (saved) return;
          setWishlistProducts((prev) =>
            prev.filter((product) => product.id !== productId),
          );
        }}
      />
    );
  }

  const preferEmail = lastUsed === "email";
  const controlsBusy = busy || Boolean(oauthPending);
  const oauth = (
    <OAuthButtons
      apiUrl={apiUrl}
      locale={locale}
      lastUsed={lastUsed}
      lastUsedLabel={labels.lastUsed}
      lastUsedDescribedBy={lastUsedDescribedBy}
      googleLabel={labels.google}
      appleLabel={labels.apple}
      redirectingLabel={labels.redirecting}
      busy={controlsBusy}
      pendingProvider={oauthPending}
      onSelect={onOAuthSelect}
    />
  );
  const emailForm = (
    <EmailSignInForm
      labels={labels}
      authMode={authMode}
      emailId={emailId}
      termsId={termsId}
      marketingId={marketingId}
      emailErrorId={emailErrorId}
      termsErrorId={termsErrorId}
      email={email}
      acceptedTerms={acceptedTerms}
      marketingOptIn={marketingOptIn}
      preferEmail={preferEmail}
      busy={controlsBusy}
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
    <div className="account-auth">
      <div className="account-panel">
        {step === "email" ? (
          <div
            className="account-mode-toggle"
            role="tablist"
            aria-label={labels.login}
            id={modeTablistId}
          >
            <button
              type="button"
              role="tab"
              className={
                authMode === "sign_in"
                  ? "account-mode-toggle__btn is-active"
                  : "account-mode-toggle__btn"
              }
              aria-selected={authMode === "sign_in"}
              disabled={controlsBusy}
              onClick={() => switchAuthMode("sign_in")}
            >
              {labels.signIn}
            </button>
            <button
              type="button"
              role="tab"
              className={
                authMode === "sign_up"
                  ? "account-mode-toggle__btn is-active"
                  : "account-mode-toggle__btn"
              }
              aria-selected={authMode === "sign_up"}
              disabled={controlsBusy}
              onClick={() => switchAuthMode("sign_up")}
            >
              {labels.signUp}
            </button>
          </div>
        ) : null}

        <p className="account-panel__lead">
          {authMode === "sign_up" ? labels.leadSignUp : labels.lead}
        </p>

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
            authMode={authMode}
            codeId={codeId}
            codeHintId={codeHintId}
            codeErrorId={codeErrorId}
            email={email}
            code={code}
            busy={controlsBusy}
            resendIn={resendIn}
            fieldErrors={fieldErrors}
            codeInputRef={codeInputRef}
            turnstileSiteKey={turnstileSiteKey}
            turnstileApiRef={turnstileApiRef}
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
            onResend={onResendOtp}
            onBack={() => {
              setStep("email");
              setCode("");
              setFieldErrors({});
              setNotice(null);
              turnstileApiRef.current?.reset();
            }}
          />
        )}

        <AccountMessage
          id={noticeId}
          notice={notice}
          onAction={(mode) => switchAuthMode(mode)}
        />
      </div>
    </div>
  );
}
