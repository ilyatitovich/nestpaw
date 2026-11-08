import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export function ReturnsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["returns"],
    queryFn: () =>
      api.get<
        {
          id: string;
          status: string;
          reason: string;
          email: string;
          order: { number: number };
        }[]
      >("/admin/returns"),
  });

  const action = useMutation({
    mutationFn: ({ id, act }: { id: string; act: string }) =>
      api.post(`/admin/returns/${id}/${act}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["returns"] }),
  });

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Returns</h1>
      </div>
      <div className="admin-panel">
        {isLoading ? (
          <p className="admin-muted">Loading…</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Email</th>
                <th>Reason</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={r.id}>
                  <td>#{r.order.number}</td>
                  <td>{r.email}</td>
                  <td>{r.reason}</td>
                  <td>{r.status}</td>
                  <td className="admin-actions">
                    {r.status === "pending" ? (
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() =>
                          action.mutate({ id: r.id, act: "approved" })
                        }
                      >
                        Approve
                      </button>
                    ) : null}
                    {r.status === "approved" || r.status === "received" ? (
                      <button
                        type="button"
                        className="admin-btn admin-btn--danger"
                        onClick={() =>
                          action.mutate({ id: r.id, act: "refunded" })
                        }
                      >
                        Refund
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
