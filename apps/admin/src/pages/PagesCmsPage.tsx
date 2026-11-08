import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api";

type PageRow = {
  id: string;
  status: string;
  translations: {
    locale: string;
    title: string;
    slug: string;
    body: string;
  }[];
};

export function PagesCmsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["pages"],
    queryFn: () => api.get<PageRow[]>("/admin/pages"),
  });
  const [editing, setEditing] = useState<PageRow | null>(null);
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("published");

  const save = useMutation({
    mutationFn: () => {
      if (!editing) return Promise.resolve(null);
      const en =
        editing.translations.find((t) => t.locale === "en") ??
        editing.translations[0];
      if (!en) return Promise.resolve(null);
      return api.patch(`/admin/pages/${editing.id}`, {
        status,
        translations: [
          {
            locale: en.locale,
            title,
            slug: en.slug,
            body,
          },
        ],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      setEditing(null);
    },
  });

  function startEdit(p: PageRow) {
    const t =
      p.translations.find((x) => x.locale === "en") ?? p.translations[0];
    setEditing(p);
    setTitle(t?.title ?? "");
    setBody(t?.body ?? "");
    setStatus(p.status);
  }

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Pages</h1>
      </div>
      {editing ? (
        <div className="admin-panel admin-stack">
          <h2>Edit {title}</h2>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="published">published</option>
            <option value="draft">draft</option>
          </select>
          <textarea
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="admin-actions">
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => save.mutate()}
            >
              Save
            </button>
            <button
              type="button"
              className="admin-btn"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <div className="admin-panel">
        {isLoading ? (
          <p className="admin-muted">Loading…</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Slug</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((p) => {
                const t =
                  p.translations.find((x) => x.locale === "en") ??
                  p.translations[0];
                return (
                  <tr key={p.id}>
                    <td>{t?.title}</td>
                    <td className="admin-mono">{t?.slug}</td>
                    <td>{p.status}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() => startEdit(p)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
