import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/api";

type Order = {
  id: string;
  number: number;
  status: string;
  email: string;
  total: number;
  currency: string;
  createdAt: string;
};

export function OrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["orders-list"],
    queryFn: () => api.get<Order[]>("/admin/orders"),
  });

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Orders</h1>
      </div>
      <div className="admin-panel">
        {isLoading ? (
          <p className="admin-muted">Loading…</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Status</th>
                <th>Email</th>
                <th>Total</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link to={`/orders/${o.id}`}>#{o.number}</Link>
                  </td>
                  <td>{o.status}</td>
                  <td>{o.email}</td>
                  <td>
                    €{(o.total / 100).toFixed(2)} {o.currency}
                  </td>
                  <td>{new Date(o.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
