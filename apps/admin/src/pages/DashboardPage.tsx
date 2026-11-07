import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export function DashboardPage() {
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.get<unknown[]>("/admin/orders?take=5"),
  });
  const analytics = useQuery({
    queryKey: ["analytics"],
    queryFn: () =>
      api.get<{ name: string; _count: number }[]>("/admin/analytics/summary"),
  });

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Dashboard</h1>
      </div>
      <div className="admin-panel">
        <h2>Recent orders</h2>
        {orders.isLoading ? (
          <p className="admin-muted">Loading…</p>
        ) : (
          <p className="admin-muted">
            {(orders.data as { number: number; status: string; total: number }[] | undefined)
              ?.length ?? 0}{" "}
            shown · open Orders for fulfillment
          </p>
        )}
      </div>
      <div className="admin-panel">
        <h2>Events</h2>
        <ul>
          {(analytics.data ?? []).map((row) => (
            <li key={row.name}>
              <span className="admin-mono">{row.name}</span>: {row._count}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
