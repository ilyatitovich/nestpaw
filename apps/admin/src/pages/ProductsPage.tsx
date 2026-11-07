import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";

type Product = {
  id: string;
  status: string;
  translations: { locale: string; title: string; slug: string }[];
  variants: { sku: string; price: number }[];
};

export function ProductsPage() {
  const products = useQuery({
    queryKey: ["admin-products-all"],
    queryFn: () => api.get<{ items: Product[] }>("/admin/products?take=100"),
  });

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Products</h1>
        <Link className="admin-btn admin-btn--primary" to="/products/new">
          New product
        </Link>
      </div>
      <div className="admin-panel">
        {products.isLoading ? (
          <p className="admin-muted">Loading…</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>SKU</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {(products.data?.items ?? []).map((p) => {
                const t =
                  p.translations.find((x) => x.locale === "en") ??
                  p.translations[0];
                const v = p.variants[0];
                return (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/products/${p.id}`}>{t?.title ?? p.id}</Link>
                    </td>
                    <td>{p.status}</td>
                    <td className="admin-mono">{v?.sku}</td>
                    <td>{v ? `€${(v.price / 100).toFixed(2)}` : "—"}</td>
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
