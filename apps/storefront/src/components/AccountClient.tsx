import { useState } from "react";

export default function AccountClient({ apiUrl }: { apiUrl: string }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

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
    setMessage("Signed in");
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem" }}>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="button" className="btn btn--ghost" onClick={() => setMode("login")}>
          Login
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setMode("register")}>
          Register
        </button>
      </div>
      {mode === "register" ? (
        <>
          <input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </>
      ) : null}
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button className="btn btn--primary" type="submit">
        {mode === "login" ? "Sign in" : "Create account"}
      </button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}
