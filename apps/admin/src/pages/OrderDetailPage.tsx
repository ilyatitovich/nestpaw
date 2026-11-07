import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const order = useQuery({
    queryKey: ["order", id],
    queryFn: () =>
      api.get<{
        id: string;
        number: number;
        status: string;
        email: string;
        total: number;
        currency: string;
        lines: {
          title: string;
          quantity: number;
          total: number;
          sku: string;
        }[];
      }>(`/admin/orders/${id}`),
  });

  const action = useMutation({
    mutationFn: (path: string) => api.post(path),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order", id] }),
  });

  if (order.isLoading) return <p className="admin-muted">Loading…</p>;
  if (!order.data) return <p>Not found</p>;
  const o = order.data;

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>
          Order #{o.number} · {o.status}
        </h1>
      </div>
      <div className="admin-panel admin-stack">
        <p>
          {o.email} · €{(o.total / 100).toFixed(2)} {o.currency}
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>SKU</th>
              <th>Qty</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {o.lines.map((l) => (
              <tr key={`${l.sku}:${l.title}:${l.quantity}:${l.total}`}>
                <td>{l.title}</td>
                <td className="admin-mono">{l.sku}</td>
                <td>{l.quantity}</td>
                <td>€{(l.total / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="admin-actions">
          {o.status === "paid" ? (
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => action.mutate(`/admin/orders/${o.id}/fulfill`)}
            >
              Fulfill
            </button>
          ) : null}
          {["pending_payment", "paid"].includes(o.status) ? (
            <button
              type="button"
              className="admin-btn"
              onClick={() => action.mutate(`/admin/orders/${o.id}/cancel`)}
            >
              Cancel
            </button>
          ) : null}
          {user?.role === "owner" &&
          ["paid", "fulfilled"].includes(o.status) ? (
            <button
              type="button"
              className="admin-btn admin-btn--danger"
              onClick={() => action.mutate(`/admin/orders/${o.id}/refund`)}
            >
              Refund
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
