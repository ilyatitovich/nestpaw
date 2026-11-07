import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, getAccessToken } from "../api";

type Subscriber = {
  id: string;
  email: string;
  locale: string;
  status: string;
  source: string;
  confirmedAt: string | null;
  createdAt: string;
};

type Campaign = {
  id: string;
  subject: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  createdBy: { email: string; name: string };
  _count: { recipients: number };
};

const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export function NewsletterPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"subscribers" | "campaigns">("subscribers");
  const [statusFilter, setStatusFilter] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("<p>Hello from Nestpaw!</p>");
  const [bodyText, setBodyText] = useState("");

  const subscribers = useQuery({
    queryKey: ["newsletter-subscribers", statusFilter],
    queryFn: () =>
      api.get<Subscriber[]>(
        `/admin/newsletter/subscribers${statusFilter ? `?status=${statusFilter}` : ""}`,
      ),
  });

  const confirmed = useQuery({
    queryKey: ["newsletter-count"],
    queryFn: () =>
      api.get<{ count: number }>("/admin/newsletter/subscribers/count"),
  });

  const campaigns = useQuery({
    queryKey: ["newsletter-campaigns"],
    queryFn: () => api.get<Campaign[]>("/admin/newsletter/campaigns"),
  });

  const createCampaign = useMutation({
    mutationFn: () =>
      api.post<Campaign>("/admin/newsletter/campaigns", {
        subject,
        bodyHtml,
        bodyText: bodyText || undefined,
      }),
    onSuccess: () => {
      setSubject("");
      qc.invalidateQueries({ queryKey: ["newsletter-campaigns"] });
    },
  });

  const sendCampaign = useMutation({
    mutationFn: (id: string) =>
      api.post(`/admin/newsletter/campaigns/${id}/send`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["newsletter-campaigns"] });
    },
  });

  async function exportCsv() {
    const token = getAccessToken();
    const url = `${apiBase}/admin/newsletter/subscribers/export${statusFilter ? `?status=${statusFilter}` : ""}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "newsletter-subscribers.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Newsletter</h1>
        <p className="admin-muted">
          {confirmed.data?.count ?? "…"} confirmed subscribers
        </p>
      </div>

      <div className="admin-actions">
        <button
          type="button"
          className={`admin-btn${tab === "subscribers" ? " admin-btn--primary" : ""}`}
          onClick={() => setTab("subscribers")}
        >
          Subscribers
        </button>
        <button
          type="button"
          className={`admin-btn${tab === "campaigns" ? " admin-btn--primary" : ""}`}
          onClick={() => setTab("campaigns")}
        >
          Campaigns
        </button>
      </div>

      {tab === "subscribers" ? (
        <div className="admin-panel admin-stack">
          <div className="admin-actions">
            <label>
              Status{" "}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="unsubscribed">Unsubscribed</option>
              </select>
            </label>
            <button
              type="button"
              className="admin-btn"
              onClick={() => exportCsv()}
            >
              Export CSV
            </button>
          </div>
          {(subscribers.data ?? []).map((s) => (
            <div key={s.id}>
              <strong>{s.email}</strong>
              <p className="admin-muted">
                {s.status} · {s.locale} · {s.source} ·{" "}
                {new Date(s.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
          {(subscribers.data ?? []).length === 0 ? (
            <p className="admin-muted">No subscribers yet.</p>
          ) : null}
        </div>
      ) : (
        <div className="admin-stack">
          <div className="admin-panel admin-stack">
            <h2>New campaign</h2>
            <p className="admin-muted">
              Sends to all confirmed subscribers via SMTP queue.
            </p>
            <label>
              Subject
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{ width: "100%" }}
              />
            </label>
            <label>
              HTML body
              <textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                rows={8}
                style={{ width: "100%", fontFamily: "monospace" }}
              />
            </label>
            <label>
              Plain text (optional)
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={4}
                style={{ width: "100%" }}
              />
            </label>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              disabled={!subject.trim() || createCampaign.isPending}
              onClick={() => createCampaign.mutate()}
            >
              Save draft
            </button>
          </div>

          <div className="admin-panel admin-stack">
            <h2>Campaigns</h2>
            {(campaigns.data ?? []).map((c) => (
              <div key={c.id}>
                <strong>{c.subject}</strong>
                <p className="admin-muted">
                  {c.status} · {c._count.recipients} recipients ·{" "}
                  {c.createdBy.name} · {new Date(c.createdAt).toLocaleString()}
                </p>
                {c.status === "draft" || c.status === "failed" ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary"
                    disabled={sendCampaign.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          `Send to ${confirmed.data?.count ?? "all"} confirmed subscribers?`,
                        )
                      ) {
                        sendCampaign.mutate(c.id);
                      }
                    }}
                  >
                    Send
                  </button>
                ) : null}
              </div>
            ))}
            {(campaigns.data ?? []).length === 0 ? (
              <p className="admin-muted">No campaigns yet.</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
