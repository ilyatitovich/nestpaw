import { useEffect, useState } from "react";

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
  labels: {
    orders: string;
    logout: string;
    noOrders: string;
  };
};

export default function AccountClient({ apiUrl, labels }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only session restore
  useEffect(() => {
    const existing = localStorage.getItem("customer_token");
    if (existing) {
      setToken(existing);
      void loadMe(existing);
    }
  }, []);

  async function loadMe(accessToken: string) {
    const res = await fetch(`${apiUrl}/customers/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      localStorage.removeItem("customer_token");
      setToken(null);
      return;
    }
    const data = (await res.json()) as {
      email: string;
      orders?: Order[];
    };
    setCustomerEmail(data.email);
    setOrders(data.orders ?? []);
  }

  async function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const path = mode === "login" ? "/customers/login" : "/customers/register";
    const body =
      mode === "login"
        ? { email, password }
        : { email, password, firstName, lastName };
    const res = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json()) as { message?: string };
      setMessage(err.message ?? "Failed");
      return;
    }
    const data = (await res.json()) as { accessToken: string };
    localStorage.setItem("customer_token", data.accessToken);
    setToken(data.accessToken);
    await loadMe(data.accessToken);
  }

  function logout() {
    localStorage.removeItem("customer_token");
    setToken(null);
    setOrders([]);
    setCustomerEmail(null);
  }

  if (token) {
    return (
      <div>
        <p>
          Signed in as <strong>{customerEmail}</strong>
        </p>
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
      </div>
    );
  }

  return (
    <form className="account-form" onSubmit={onSubmit}>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setMode("login")}
        >
          Login
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setMode("register")}
        >
          Register
        </button>
      </div>
      {mode === "register" ? (
        <>
          <input
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <input
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </>
      ) : null}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button className="btn btn--primary" type="submit">
        {mode === "login" ? "Sign in" : "Create account"}
      </button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}
