import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export function PagesCmsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["pages"],
    queryFn: () =>
      api.get<
        {
          id: string;
          status: string;
          translations: { locale: string; title: string; slug: string }[];
        }[]
      >("/admin/pages"),
  });

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Pages</h1>
      </div>
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
