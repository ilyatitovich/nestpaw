import { useState } from "react";

type Props = {
  apiUrl: string;
  productId: string;
  label: string;
};

export default function ReviewForm({ apiUrl, productId, label }: Props) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${apiUrl}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          rating,
          title: title || undefined,
          body,
          authorName,
          authorEmail,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? "Failed");
      }
      setMessage("Thanks — your review is pending moderation.");
      setBody("");
      setTitle("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="review-form" onSubmit={onSubmit}>
      <h3 style={{ margin: 0 }}>{label}</h3>
      <label>
        Rating
        <select
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n}/5
            </option>
          ))}
        </select>
      </label>
      <input
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        required
        rows={4}
        placeholder="Your review"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <input
        required
        placeholder="Your name"
        value={authorName}
        onChange={(e) => setAuthorName(e.target.value)}
      />
      <input
        required
        type="email"
        placeholder="Email"
        value={authorEmail}
        onChange={(e) => setAuthorEmail(e.target.value)}
      />
      <button className="btn btn--primary" type="submit" disabled={busy}>
        Submit
      </button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}
