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
} from "../lib/account-validation";
import {
  type AccountAddress,
  type AccountLabels,
  type AccountOrder,
  type AuthStep,
  clearAccountTabFromUrl,
  clearPendingAuth,
  consumeAuthErrorMessage,
  consumeMarketingOptIn,
  fetchCustomerMe,
  logoutCustomer,
  type OAuthProvider,
  optInCustomerNewsletter,
  persistMarketingOptIn,
  persistPendingAuth,
  readAuthStepFromUrl,
  readPendingAuth,
  refreshCustomerSession,
  rememberAuthMethod,
  requestCustomerOtp,
  updateCustomerProfile,
  verifyCustomerOtp,
  writeAuthStepToUrl,
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

const AUTH_MEDIA_SRC =
  "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=1600&q=80";

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

function readInitialGuestAuth(): {
  step: AuthStep;
  email: string;
  marketingOptIn: boolean;
} {
  if (typeof window === "undefined") {
    return { step: "email", email: "", marketingOptIn: false };
  }
  const pending = readPendingAuth();
  const step = readAuthStepFromUrl();
  if (step === "code" && pending?.email) {
    return {
      step: "code",
      email: pending.email,
      marketingOptIn: pending.marketingOptIn,
    };
  }
  return {
    step: "email",
    email: pending?.email ?? "",
    marketingOptIn: pending?.marketingOptIn ?? false,
  };
}

type Props = {
  apiUrl: string;
  locale: string;
  turnstileSiteKey: string;
  termsHref: string;
  privacyHref: string;
  shopHref: string;
  homeHref: string;
  storeName: string;
  labels: AccountLabels;
};

const EMAIL_FOCUS_ORDER: AuthField[] = ["email"];
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
  homeHref,
  storeName,
  labels,
}: Props) {
  const baseId = useId();
  const emailId = `${baseId}-email`;
  const codeId = `${baseId}-code`;
  const marketingId = `${baseId}-marketing`;
  const codeHintId = `${baseId}-code-hint`;
  const noticeId = `${baseId}-notice`;
  const emailErrorId = `${baseId}-email-error`;
  const codeErrorId = `${baseId}-code-error`;
  const firstNameId = `${baseId}-first`;
  const lastNameId = `${baseId}-last`;
  const firstNameErrorId = `${baseId}-first-error`;
  const lastNameErrorId = `${baseId}-last-error`;

  const [initialGuestAuth] = useState(readInitialGuestAuth);
  const [step, setStep] = useState<AuthStep>(initialGuestAuth.step);
  const [email, setEmail] = useState(initialGuestAuth.email);
  const [code, setCode] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(
    initialGuestAuth.marketingOptIn,
  );
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
    if (readAuthStepFromUrl() === "code" && !readPendingAuth()?.email) {
      writeAuthStepToUrl("email", "replace");
    }
  }, []);

  useEffect(() => {
    function onPopState() {
      const nextStep = readAuthStepFromUrl();
      const pending = readPendingAuth();
      if (nextStep === "code" && !pending?.email) {
        writeAuthStepToUrl("email", "replace");
        setStep("email");
        setCode("");
        setFieldErrors({});
        setNotice(null);
        return;
      }
      setStep(nextStep);
      setCode("");
      setFieldErrors({});
      setNotice(null);
      if (nextStep === "code" && pending) {
        setEmail(pending.email);
        setMarketingOptIn(pending.marketingOptIn);
      }
      turnstileApiRef.current?.reset();
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
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
          if (ok) {
            clearPendingAuth();
            writeAuthStepToUrl("email", "replace");
            if (pendingMarketing) {
              void optInCustomerNewsletter({
                apiUrl,
                accessToken,
                locale,
              });
            }
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
    if (field === "code") {
      codeInputRef.current?.focus();
      return;
    }
    const ids: Record<Exclude<AuthField, "code">, string> = {
      email: emailId,
      firstName: firstNameId,
      lastName: lastNameId,
    };
    focusField(ids[field]);
  }

  function onOAuthSelect(
    e: React.MouseEvent<HTMLAnchorElement>,
    provider: OAuthProvider,
  ) {
    if (busy || oauthPending) {
      e.preventDefault();
      return;
    }
    persistMarketingOptIn(marketingOptIn);
    setNotice(null);
    setOauthPending(provider);
    setBusy(true);
    remember(provider);
  }

  function onShopSelect() {
    if (busy || oauthPending) return;
    setNotice({ tone: "error", text: labels.shopUnavailable });
  }

  async function sendOtpCode(): Promise<boolean> {
    const turnstileToken = turnstileApiRef.current?.getToken() ?? "";
    const result = validateEmailStep({
      email,
      turnstileToken,
      labels,
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
      });
      if (!response.ok) {
        setNotice(authFailureNotice(response, labels));
        turnstileApiRef.current?.reset();
        return false;
      }
      persistPendingAuth({ email, marketingOptIn });
      writeAuthStepToUrl("code", "push");
      setStep("code");
      setCode("");
      setResendIn(60);
      setNotice({
        tone: "success",
        text: labels.codeSent,
      });
      return true;
    } finally {
      setBusy(false);
    }
  }

  function goToEmailStep() {
    setCode("");
    setFieldErrors({});
    setNotice(null);
    turnstileApiRef.current?.reset();
    const historyState = window.history.state as { authStep?: AuthStep } | null;
    if (historyState?.authStep === "code") {
      window.history.back();
      return;
    }
    writeAuthStepToUrl("email", "replace");
    setStep("email");
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
      });
      if (!response.ok) {
        setNotice(authFailureNotice(response, labels));
        turnstileApiRef.current?.reset();
        return;
      }
      setResendIn(60);
      setNotice({
        tone: "success",
        text: labels.codeSent,
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
        marketingOptIn,
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
        if (response.kind === "invalid_code") {
          codeInputRef.current?.focus();
        }
        return;
      }
      remember("email");
      setNotice(null);
      clearPendingAuth();
      writeAuthStepToUrl("email", "replace");
      setStep("email");
      const ok = await applyCustomer(response.accessToken);
      setSessionStatus(ok ? "member" : "guest");
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await logoutCustomer(apiUrl);
    clearAccountTabFromUrl();
    clearPendingAuth();
    writeAuthStepToUrl("email", "replace");
    setToken(null);
    setOrders([]);
    setAddresses([]);
    setCustomerEmail(null);
    setFirstName("");
    setLastName("");
    setStep("email");
    setCode("");
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
      <div className="container page-shell account-page__member">
        <h1 className="section__title account-page__title">{labels.login}</h1>
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
      </div>
    );
  }

  const controlsBusy = busy || Boolean(oauthPending);
  const oauth = (
    <OAuthButtons
      apiUrl={apiUrl}
      locale={locale}
      lastUsed={lastUsed}
      googleLabel={labels.google}
      appleLabel={labels.apple}
      shopLabel={labels.shop}
      redirectingLabel={labels.redirecting}
      busy={controlsBusy}
      pendingProvider={oauthPending}
      onSelect={onOAuthSelect}
      onShopSelect={onShopSelect}
    />
  );
  const emailForm = (
    <EmailSignInForm
      labels={labels}
      emailId={emailId}
      marketingId={marketingId}
      emailErrorId={emailErrorId}
      email={email}
      marketingOptIn={marketingOptIn}
      busy={controlsBusy}
      fieldErrors={fieldErrors}
      termsHref={termsHref}
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
    <div className="account-auth-shell">
      <div className="account-auth-shell__pane">
        <a className="account-auth-shell__brand" href={homeHref}>
          {storeName}
        </a>

        <div className="account-auth">
          <div className="account-panel">
            {step === "email" ? (
              <>
                <div className="account-panel__intro">
                  <h1 className="account-panel__title">{labels.signIn}</h1>
                  <p className="account-panel__lead">{labels.lead}</p>
                </div>

                {oauth}
                {divider}
                {emailForm}
              </>
            ) : (
              <OtpVerifyForm
                labels={labels}
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
                onBack={goToEmailStep}
              />
            )}

            <AccountMessage id={noticeId} notice={notice} />
          </div>
        </div>

        <a className="account-auth-shell__privacy" href={privacyHref}>
          {labels.privacy}
        </a>
      </div>

      <div className="account-auth-shell__media" aria-hidden="true">
        <img
          src={AUTH_MEDIA_SRC}
          alt=""
          width={1600}
          height={2000}
          decoding="async"
        />
      </div>
    </div>
  );
}
