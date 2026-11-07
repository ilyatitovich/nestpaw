import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api";

type Row = {
  variantId: string;
  quantity: number;
  variant: {
    sku: string;
    product: { translations: { locale: string; title: string }[] };
  };
};

export function InventoryPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api.get<Row[]>("/admin/inventory"),
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (variantId: string) =>
      api.patch(`/admin/inventory/${variantId}`, {
        quantity: Number(drafts[variantId]),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Inventory</h1>
      </div>
      <div className="admin-panel">
        {isLoading ? (
          <p className="admin-muted">Loading…</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Qty</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row) => {
                const title =
                  row.variant.product.translations.find(
                    (t) => t.locale === "en",
                  )?.title ?? row.variant.sku;
                const value = drafts[row.variantId] ?? String(row.quantity);
                return (
                  <tr key={row.variantId}>
                    <td>{title}</td>
                    <td className="admin-mono">{row.variant.sku}</td>
                    <td>
                      <input
                        value={value}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [row.variantId]: e.target.value,
                          }))
                        }
                        style={{ width: "5rem" }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() => save.mutate(row.variantId)}
                      >
                        Save
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
