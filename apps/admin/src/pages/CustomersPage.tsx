import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export function CustomersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () =>
      api.get<{ id: string; email: string; firstName: string; lastName: string }[]>(
        "/admin/customers",
      ),
  });

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Customers</h1>
      </div>
      <div className="admin-panel">
        {isLoading ? (
          <p className="admin-muted">Loading…</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.firstName} {c.lastName}
                  </td>
                  <td>{c.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
