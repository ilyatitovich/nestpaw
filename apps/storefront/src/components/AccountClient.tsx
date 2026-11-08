import { useEffect, useId, useRef, useState } from "react";
import { setAccountChrome } from "../lib/account-chrome";
import {
  type AccountLabels,
  type AccountOrder,
  type AuthStep,
  type OAuthProvider,
  consumeAuthErrorMessage,
  ensureTurnstileScript,
  fetchCustomerMe,
  logoutCustomer,
  readTurnstileToken,
  refreshCustomerSession,
  rememberAuthMethod,
  requestCustomerOtp,
  resetTurnstile,
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

type Props = {
  apiUrl: string;
  locale: string;
  turnstileSiteKey: string;
  termsHref: string;
  privacyHref: string;
  labels: AccountLabels;
};

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
  const messageId = `${baseId}-message`;
  const lastUsedDescribedBy = `${baseId}-last-used`;

  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [lastUsed, setLastUsed] = useState<AuthMethod | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLastUsed(getLastAuthMethod());
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only session restore
  useEffect(() => {
    const authError = consumeAuthErrorMessage(labels);
    if (authError) setMessage(authError);

    void (async () => {
      try {
        const accessToken = await refreshCustomerSession(apiUrl);
        if (!accessToken) return;
        setToken(accessToken);
        await applyCustomer(accessToken);
      } catch {
        // stay signed out
      }
    })();
  }, []);

  useEffect(() => {
    setAccountChrome(token ? "member" : "guest");
  }, [token]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  useEffect(() => {
    if (step !== "email" || token) return;
    ensureTurnstileScript();
  }, [step, token]);

  async function applyCustomer(accessToken: string) {
    const customer = await fetchCustomerMe(apiUrl, accessToken);
    if (!customer) {
      setToken(null);
      return;
    }
    setCustomerEmail(customer.email);
    setOrders(customer.orders ?? []);
    setFirstName(customer.firstName ?? "");
    setLastName(customer.lastName ?? "");
    setNeedsName(!customer.firstName || !customer.lastName);
  }

  function remember(method: AuthMethod) {
    setLastUsed(rememberAuthMethod(method));
  }

  function onOAuthSelect(
    e: React.MouseEvent<HTMLAnchorElement>,
    provider: OAuthProvider,
  ) {
    if (!acceptedTerms) {
      e.preventDefault();
      setMessage(labels.termsRequired);
      return;
    }
    remember(provider);
  }

  async function onRequestOtp(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!acceptedTerms) {
      setMessage(labels.termsRequired);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const turnstileToken = readTurnstileToken(turnstileRef.current);
      if (!turnstileToken) {
        setMessage(labels.errorGeneric);
        return;
      }
      const ok = await requestCustomerOtp({
        apiUrl,
        email,
        locale,
        turnstileToken,
      });
      if (!ok) {
        setMessage(labels.errorGeneric);
        resetTurnstile(turnstileRef.current);
        return;
      }
      setStep("code");
      setResendIn(60);
      setMessage(labels.codeSent);
    } catch {
      setMessage(labels.errorGeneric);
      resetTurnstile(turnstileRef.current);
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyOtp(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const accessToken = await verifyCustomerOtp({ apiUrl, email, code });
      if (!accessToken) {
        setMessage(labels.errorGeneric);
        return;
      }
      remember("email");
      setToken(accessToken);
      await applyCustomer(accessToken);
    } catch {
      setMessage(labels.errorGeneric);
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
  }

  async function onSaveProfile(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const access = getCustomerAccessToken();
    if (!access) return;
    setBusy(true);
    try {
      const ok = await updateCustomerProfile({
        apiUrl,
        accessToken: access,
        firstName,
        lastName,
      });
      if (!ok) {
        setMessage(labels.errorGeneric);
        return;
      }
      setNeedsName(false);
    } finally {
      setBusy(false);
    }
  }

  if (token) {
    return (
      <SignedInPanel
        labels={labels}
        customerEmail={customerEmail}
        orders={orders}
        needsName={needsName}
        firstName={firstName}
        lastName={lastName}
        busy={busy}
        message={message}
        onFirstNameChange={setFirstName}
        onLastNameChange={setLastName}
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
      messageId={messageId}
      email={email}
      acceptedTerms={acceptedTerms}
      marketingOptIn={marketingOptIn}
      preferEmail={preferEmail}
      busy={busy}
      message={message}
      termsHref={termsHref}
      privacyHref={privacyHref}
      turnstileSiteKey={turnstileSiteKey}
      turnstileRef={turnstileRef}
      onEmailChange={setEmail}
      onAcceptedTermsChange={setAcceptedTerms}
      onMarketingOptInChange={setMarketingOptIn}
      onClearTermsMessage={() => {
        if (message === labels.termsRequired) setMessage(null);
      }}
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
          email={email}
          code={code}
          busy={busy}
          resendIn={resendIn}
          codeInputRef={codeInputRef}
          onCodeChange={setCode}
          onSubmit={onVerifyOtp}
          onBack={() => {
            setStep("email");
            setCode("");
            setMessage(null);
          }}
        />
      )}

      <AccountMessage id={messageId} message={message} />
    </div>
  );
}
