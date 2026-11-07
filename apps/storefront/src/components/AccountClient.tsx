import { useEffect, useRef, useState } from "react";
import {
  getCustomerAccessToken,
  setCustomerAccessToken,
} from "../lib/customer-auth";

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
    nameFirst: string;
    nameLast: string;
    saveProfile: string;
    errorGeneric: string;
    oauthDenied: string;
  };
};

type Step = "email" | "code";

export default function AccountClient({
  apiUrl,
  locale,
  turnstileSiteKey,
  labels,
}: Props) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [providers, setProviders] = useState({ google: false, apple: false });
  const [resendIn, setResendIn] = useState(0);
  const turnstileRef = useRef<HTMLDivElement>(null);

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
        const prov = await fetch(`${apiUrl}/customers/auth/providers`, {
          credentials: "include",
        });
        if (prov.ok) {
          setProviders(
            (await prov.json()) as { google: boolean; apple: boolean },
          );
        }
      } catch {
        // ignore
      }

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

  async function requestOtp(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
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

  if (token) {
    return (
      <div>
        <p>
          {labels.signedInAs} <strong>{customerEmail}</strong>
        </p>
        {needsName ? (
          <form className="account-form" onSubmit={saveProfile}>
            <input
              placeholder={labels.nameFirst}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <input
              placeholder={labels.nameLast}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {labels.saveProfile}
            </button>
          </form>
        ) : null}
        <button type="button" className="btn btn--ghost" onClick={logout}>
          {labels.logout}
        </button>
        <h2
          className="section__title"
          style={{ fontSize: "1.35rem", marginTop: "2rem" }}
        >
          {labels.orders}
        </h2>
        {!orders.length ? <p>{labels.noOrders}</p> : null}
        <div className="order-list">
          {orders.map((o) => (
            <div className="order-row" key={o.id}>
              <div>
                <strong>#{o.number}</strong>
                <div style={{ color: "var(--color-ink-muted)" }}>
                  {new Date(o.createdAt).toLocaleDateString()} · {o.status}
                </div>
              </div>
              <div>
                €{((o.total ?? 0) / 100).toFixed(2)} {o.currency ?? "EUR"}
              </div>
            </div>
          ))}
        </div>
        {message ? <p>{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="account-form">
      {providers.google || providers.apple ? (
        <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1.25rem" }}>
          {providers.google ? (
            <a
              className="btn btn--ghost"
              href={`${apiUrl}/customers/auth/oauth/google/start?locale=${locale}`}
            >
              {labels.google}
            </a>
          ) : null}
          {providers.apple ? (
            <a
              className="btn btn--ghost"
              href={`${apiUrl}/customers/auth/oauth/apple/start?locale=${locale}`}
            >
              {labels.apple}
            </a>
          ) : null}
          <p style={{ textAlign: "center", color: "var(--color-ink-muted)" }}>
            {labels.or}
          </p>
        </div>
      ) : null}

      {step === "email" ? (
        <form onSubmit={requestOtp}>
          <input
            type="email"
            placeholder={labels.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <div ref={turnstileRef}>
            <div
              className="cf-turnstile"
              data-sitekey={turnstileSiteKey}
              data-theme="light"
              data-size="flexible"
            />
          </div>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {labels.sendCode}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp}>
          <p style={{ color: "var(--color-ink-muted)" }}>
            {labels.codeSent} ({email})
          </p>
          <input
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder={labels.code}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            autoComplete="one-time-code"
          />
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {labels.verify}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={resendIn > 0 || busy}
            onClick={() => {
              setStep("email");
              setCode("");
              setMessage(null);
            }}
          >
            {resendIn > 0
              ? labels.resendIn.replace("{n}", String(resendIn))
              : labels.resend}
          </button>
        </form>
      )}
      {message ? <p>{message}</p> : null}
    </div>
  );
}
