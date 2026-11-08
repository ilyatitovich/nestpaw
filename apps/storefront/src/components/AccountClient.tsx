import {
  type ReactElement,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { setAccountChrome } from "../lib/account-chrome";
import {
  getCustomerAccessToken,
  setCustomerAccessToken,
} from "../lib/customer-auth";
import {
  type AuthMethod,
  getLastAuthMethod,
  setLastAuthMethod,
} from "../lib/last-auth-method";

type Order = {
  id: string;
  number: number;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
};

type Props = {
  apiUrl: string;
  locale: string;
  turnstileSiteKey: string;
  termsHref: string;
  privacyHref: string;
  labels: {
    orders: string;
    logout: string;
    noOrders: string;
    email: string;
    continue: string;
    code: string;
    verify: string;
    resend: string;
    resendIn: string;
    google: string;
    apple: string;
    or: string;
    signedInAs: string;
    sendCode: string;
    codeSent: string;
    codeHint: string;
    nameFirst: string;
    nameLast: string;
    saveProfile: string;
    errorGeneric: string;
    oauthDenied: string;
    stepsLabel: string;
    stepEmail: string;
    stepCode: string;
    termsBefore: string;
    terms: string;
    termsAnd: string;
    privacy: string;
    termsAfter: string;
    marketingOptIn: string;
    termsRequired: string;
    lead: string;
    lastUsed: string;
  };
};

type Step = "email" | "code";

function GoogleIcon() {
  return (
    <svg
      className="account-oauth__icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      className="account-oauth__icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M16.365 1.43c0 1.14-.42 2.2-1.18 3.03-.8.88-2.13 1.56-3.25 1.47-.14-1.1.4-2.27 1.15-3.07.82-.89 2.23-1.55 3.28-1.43zM20.8 17.4c-.58 1.33-.85 1.92-1.59 3.1-1.03 1.6-2.48 3.59-4.28 3.61-1.6.02-2.02-1.05-4.2-1.03-2.18.01-2.64 1.06-4.24 1.04-1.8-.03-3.17-1.82-4.2-3.42C.5 17.1-.7 12.3 1.2 9.05c1.1-1.9 2.85-3.1 4.5-3.1 1.68 0 2.74 1.1 4.13 1.1 1.35 0 2.17-1.11 4.17-1.11 1.49 0 3.06.81 4.16 2.21-3.65 2-3.05 7.2.64 9.25z" />
    </svg>
  );
}

function LastUsedBadge({ label }: { label: string }) {
  return <span className="account-last-used">{label}</span>;
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
  const messageId = `${baseId}-message`;

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
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
    const params = new URLSearchParams(window.location.search);
    if (params.get("authError")) {
      setMessage(
        params.get("authError") === "oauth_denied"
          ? labels.oauthDenied
          : labels.errorGeneric,
      );
      window.history.replaceState({}, "", window.location.pathname);
    }

    void (async () => {
      try {
        const res = await fetch(`${apiUrl}/customers/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          accessToken: string | null;
          customer: { email: string } | null;
        };
        if (!data.accessToken) return;
        setCustomerAccessToken(data.accessToken);
        setToken(data.accessToken);
        await loadMe(data.accessToken);
      } catch {
        setCustomerAccessToken(null);
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
    const scriptId = "cf-turnstile-script";
    if (!document.getElementById(scriptId)) {
      const s = document.createElement("script");
      s.id = scriptId;
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      s.defer = true;
      document.body.appendChild(s);
    }
  }, [step, token]);

  useEffect(() => {
    if (step === "code") {
      codeInputRef.current?.focus();
    }
  }, [step]);

  async function loadMe(accessToken: string) {
    const res = await fetch(`${apiUrl}/customers/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: "include",
    });
    if (!res.ok) {
      setCustomerAccessToken(null);
      setToken(null);
      return;
    }
    const data = (await res.json()) as {
      email: string;
      firstName?: string | null;
      lastName?: string | null;
      orders?: Order[];
    };
    setCustomerEmail(data.email);
    setOrders(data.orders ?? []);
    setFirstName(data.firstName ?? "");
    setLastName(data.lastName ?? "");
    setNeedsName(!data.firstName || !data.lastName);
  }

  function turnstileToken(): string {
    const input = turnstileRef.current?.querySelector(
      "[name='cf-turnstile-response']",
    );
    return input instanceof HTMLInputElement ? input.value : "";
  }

  function resetTurnstile() {
    const widget = turnstileRef.current?.querySelector(".cf-turnstile");
    if (widget instanceof HTMLElement) {
      window.turnstile?.reset(widget);
    }
  }

  function requireTerms(): boolean {
    if (acceptedTerms) return true;
    setMessage(labels.termsRequired);
    return false;
  }

  function rememberMethod(method: AuthMethod) {
    setLastAuthMethod(method);
    setLastUsed(method);
  }

  function onOAuthClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    method: Extract<AuthMethod, "google" | "apple">,
  ) {
    if (!acceptedTerms) {
      e.preventDefault();
      setMessage(labels.termsRequired);
      return;
    }
    rememberMethod(method);
  }

  async function requestOtp(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireTerms()) return;
    setBusy(true);
    setMessage(null);
    try {
      const ts = turnstileToken();
      if (!ts) {
        setMessage(labels.errorGeneric);
        return;
      }
      const res = await fetch(`${apiUrl}/customers/auth/otp/request`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          locale,
          turnstileToken: ts,
        }),
      });
      if (!res.ok) {
        setMessage(labels.errorGeneric);
        resetTurnstile();
        return;
      }
      setStep("code");
      setResendIn(60);
      setMessage(labels.codeSent);
    } catch {
      setMessage(labels.errorGeneric);
      resetTurnstile();
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${apiUrl}/customers/auth/otp/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) {
        setMessage(labels.errorGeneric);
        return;
      }
      const data = (await res.json()) as { accessToken: string };
      rememberMethod("email");
      setCustomerAccessToken(data.accessToken);
      setToken(data.accessToken);
      await loadMe(data.accessToken);
    } catch {
      setMessage(labels.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch(`${apiUrl}/customers/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    setCustomerAccessToken(null);
    setToken(null);
    setOrders([]);
    setCustomerEmail(null);
    setStep("email");
    setCode("");
    setAcceptedTerms(false);
    setMarketingOptIn(false);
  }

  async function saveProfile(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const access = getCustomerAccessToken();
    if (!access) return;
    setBusy(true);
    try {
      const res = await fetch(`${apiUrl}/customers/me`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({ firstName, lastName }),
      });
      if (!res.ok) {
        setMessage(labels.errorGeneric);
        return;
      }
      setNeedsName(false);
    } finally {
      setBusy(false);
    }
  }

  function goBackToEmail() {
    setStep("email");
    setCode("");
    setMessage(null);
  }

  const oauthProviders: Array<{
    id: Extract<AuthMethod, "google" | "apple">;
    label: string;
    icon: ReactElement;
  }> = [
    { id: "google", label: labels.google, icon: <GoogleIcon /> },
    { id: "apple", label: labels.apple, icon: <AppleIcon /> },
  ];
  if (lastUsed === "apple") {
    oauthProviders.reverse();
  }

  const preferEmail = lastUsed === "email";

  const oauthBlock = (
    <div className="account-oauth">
      {oauthProviders.map((provider) => {
        const isLast = lastUsed === provider.id;
        return (
          <a
            key={provider.id}
            className={
              isLast
                ? `account-oauth__btn account-oauth__btn--${provider.id} is-last-used`
                : `account-oauth__btn account-oauth__btn--${provider.id}`
            }
            href={`${apiUrl}/customers/auth/oauth/${provider.id}/start?locale=${locale}`}
            onClick={(e) => onOAuthClick(e, provider.id)}
            aria-describedby={isLast ? `${baseId}-last-used` : undefined}
          >
            {provider.icon}
            <span className="account-oauth__label">{provider.label}</span>
            {isLast ? <LastUsedBadge label={labels.lastUsed} /> : null}
          </a>
        );
      })}
    </div>
  );

  const emailForm = (
    <form
      className={
        preferEmail ? "account-form is-last-used" : "account-form"
      }
      onSubmit={requestOtp}
      method="post"
    >
      {preferEmail ? (
        <div className="account-form__last-used">
          <LastUsedBadge label={labels.lastUsed} />
        </div>
      ) : null}
      <div className="account-field">
        <label htmlFor={emailId}>{labels.email}</label>
        <input
          id={emailId}
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          enterKeyHint="next"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={message ? messageId : undefined}
        />
      </div>

      <fieldset className="account-consents">
        <legend className="visually-hidden">{labels.terms}</legend>
        <label className="account-check" htmlFor={termsId}>
          <input
            id={termsId}
            name="terms"
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => {
              setAcceptedTerms(e.target.checked);
              if (e.target.checked && message === labels.termsRequired) {
                setMessage(null);
              }
            }}
            required
          />
          <span>
            {labels.termsBefore}
            <a href={termsHref} target="_blank" rel="noopener noreferrer">
              {labels.terms}
            </a>
            {labels.termsAnd}
            <a href={privacyHref} target="_blank" rel="noopener noreferrer">
              {labels.privacy}
            </a>
            {labels.termsAfter}
          </span>
        </label>
        <label className="account-check" htmlFor={marketingId}>
          <input
            id={marketingId}
            name="marketing"
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
          />
          <span>{labels.marketingOptIn}</span>
        </label>
      </fieldset>

      <div ref={turnstileRef} className="account-turnstile">
        <div
          className="cf-turnstile"
          data-sitekey={turnstileSiteKey}
          data-theme="light"
          data-size="flexible"
        />
      </div>

      <button
        className="btn btn--primary account-form__submit"
        type="submit"
        disabled={busy}
      >
        {labels.sendCode}
      </button>
    </form>
  );

  if (token) {
    return (
      <div className="account-panel account-panel--signed-in">
        <p className="account-panel__signed-in">
          {labels.signedInAs} <strong>{customerEmail}</strong>
        </p>
        {needsName ? (
          <form className="account-form" onSubmit={saveProfile}>
            <div className="account-field">
              <label htmlFor={`${baseId}-first`}>{labels.nameFirst}</label>
              <input
                id={`${baseId}-first`}
                name="given-name"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="account-field">
              <label htmlFor={`${baseId}-last`}>{labels.nameLast}</label>
              <input
                id={`${baseId}-last`}
                name="family-name"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {labels.saveProfile}
            </button>
          </form>
        ) : null}
        <button type="button" className="btn btn--ghost" onClick={logout}>
          {labels.logout}
        </button>
        <h2 className="account-panel__orders-title">{labels.orders}</h2>
        {!orders.length ? (
          <p className="account-panel__empty">{labels.noOrders}</p>
        ) : null}
        <div className="order-list">
          {orders.map((o) => (
            <div className="order-row" key={o.id}>
              <div>
                <strong>#{o.number}</strong>
                <div className="order-row__meta">
                  {new Date(o.createdAt).toLocaleDateString()} · {o.status}
                </div>
              </div>
              <div>
                €{((o.total ?? 0) / 100).toFixed(2)} {o.currency ?? "EUR"}
              </div>
            </div>
          ))}
        </div>
        {message ? (
          <p className="account-message" role="status" aria-live="polite">
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="account-panel">
      <p className="account-panel__lead">{labels.lead}</p>

      <nav className="account-steps" aria-label={labels.stepsLabel}>
        <ol className="account-steps__list">
          <li
            className={
              step === "email"
                ? "account-steps__item is-current"
                : "account-steps__item is-done"
            }
            aria-current={step === "email" ? "step" : undefined}
          >
            <span className="account-steps__num" aria-hidden="true">
              1
            </span>
            <span className="account-steps__label">{labels.stepEmail}</span>
          </li>
          <li
            className={
              step === "code"
                ? "account-steps__item is-current"
                : "account-steps__item"
            }
            aria-current={step === "code" ? "step" : undefined}
          >
            <span className="account-steps__num" aria-hidden="true">
              2
            </span>
            <span className="account-steps__label">{labels.stepCode}</span>
          </li>
        </ol>
      </nav>

      {lastUsed ? (
        <span id={`${baseId}-last-used`} className="visually-hidden">
          {labels.lastUsed}
        </span>
      ) : null}

      {step === "email" ? (
        <>
          {preferEmail ? (
            <>
              {emailForm}
              <p className="account-divider">
                <span>{labels.or}</span>
              </p>
              {oauthBlock}
            </>
          ) : (
            <>
              {oauthBlock}
              <p className="account-divider">
                <span>{labels.or}</span>
              </p>
              {emailForm}
            </>
          )}
        </>
      ) : (
        <form className="account-form" onSubmit={verifyOtp} method="post">
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
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              required
              autoComplete="one-time-code"
              enterKeyHint="done"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby={codeHintId}
              className="account-otp-input"
            />
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
            onClick={goBackToEmail}
          >
            {resendIn > 0
              ? labels.resendIn.replace("{n}", String(resendIn))
              : labels.resend}
          </button>
        </form>
      )}

      {message ? (
        <p
          id={messageId}
          className="account-message"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
