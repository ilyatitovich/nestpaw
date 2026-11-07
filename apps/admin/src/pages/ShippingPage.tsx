import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export function ShippingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["shipping-zones"],
    queryFn: () =>
      api.get<
        {
          id: string;
          name: string;
          countries: string[];
          rates: { name: string; price: number }[];
        }[]
      >("/admin/shipping/zones"),
  });

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Shipping</h1>
      </div>
      <div className="admin-panel">
        {isLoading ? (
          <p className="admin-muted">Loading…</p>
        ) : (
          (data ?? []).map((z) => (
            <div key={z.id} style={{ marginBottom: "1rem" }}>
              <h2>{z.name}</h2>
              <p className="admin-muted">{z.countries.join(", ")}</p>
              <ul>
                {z.rates.map((r) => (
                  <li key={r.name}>
                    {r.name}: €{(r.price / 100).toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
