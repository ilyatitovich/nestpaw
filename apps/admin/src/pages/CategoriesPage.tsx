import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/api";

type Translation = { locale: string; title: string; slug: string };
type Collection = {
  id: string;
  parentId: string | null;
  translations: Translation[];
  _count?: { products: number; children: number };
};

export function CategoriesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-collections"],
    queryFn: () => api.get<Collection[]>("/admin/collections"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/collections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-collections"] }),
  });

  const items = data ?? [];
  const roots = items.filter((c) => !c.parentId);
  const childrenOf = (id: string) => items.filter((c) => c.parentId === id);
  const title = (c: Collection) =>
    c.translations.find((t) => t.locale === "en")?.title ??
    c.translations[0]?.title ??
    c.id;

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Categories</h1>
        <Link className="admin-btn admin-btn--primary" to="/categories/new">
          New category
        </Link>
      </div>
      {isLoading ? <p>Loading…</p> : null}
      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Slug</th>
              <th>Products</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {roots.flatMap((root) => {
              const rows = [
                <tr key={root.id}>
                  <td>
                    <Link to={`/categories/${root.id}`}>{title(root)}</Link>
                  </td>
                  <td>
                    {root.translations.find((t) => t.locale === "en")?.slug}
                  </td>
                  <td>{root._count?.products ?? 0}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => {
                        if (confirm(`Delete “${title(root)}”?`)) {
                          remove.mutate(root.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>,
              ];
              for (const child of childrenOf(root.id)) {
                rows.push(
                  <tr key={child.id}>
                    <td style={{ paddingLeft: "1.5rem" }}>
                      <Link to={`/categories/${child.id}`}>
                        ↳ {title(child)}
                      </Link>
                    </td>
                    <td>
                      {child.translations.find((t) => t.locale === "en")?.slug}
                    </td>
                    <td>{child._count?.products ?? 0}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() => {
                          if (confirm(`Delete “${title(child)}”?`)) {
                            remove.mutate(child.id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>,
                );
              }
              return rows;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
