import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export function SubscriptionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: () =>
      api.get<
        {
          id: string;
          status: string;
          intervalDays: number;
          nextOrderAt: string;
          customer: { email: string };
          variant: { sku: string; price: number };
        }[]
      >("/admin/subscriptions"),
  });

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Subscriptions</h1>
      </div>
      <div className="admin-panel">
        {isLoading ? (
          <p className="admin-muted">Loading…</p>
        ) : (data ?? []).length === 0 ? (
          <p className="admin-muted">No subscribe-and-save subscriptions yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>SKU</th>
                <th>Interval</th>
                <th>Next</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{s.customer.email}</td>
                  <td className="admin-mono">{s.variant.sku}</td>
                  <td>{s.intervalDays}d</td>
                  <td>{new Date(s.nextOrderAt).toLocaleDateString()}</td>
                  <td>{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
