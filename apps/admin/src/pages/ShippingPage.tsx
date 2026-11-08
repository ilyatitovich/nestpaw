import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api";

export function ShippingPage() {
  const qc = useQueryClient();
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

  const [name, setName] = useState("");
  const [countries, setCountries] = useState("DE,AT");
  const [rateName, setRateName] = useState("Standard");
  const [ratePrice, setRatePrice] = useState("499");

  const create = useMutation({
    mutationFn: () =>
      api.post("/admin/shipping/zones", {
        name,
        countries: countries
          .split(",")
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean),
        rates: [
          {
            name: rateName,
            price: Number(ratePrice),
            minWeightGrams: 0,
          },
        ],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-zones"] });
      setName("");
    },
  });

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Shipping</h1>
      </div>
      <div className="admin-panel admin-stack">
        <h2>New zone</h2>
        <div className="admin-actions" style={{ flexWrap: "wrap" }}>
          <input
            placeholder="Zone name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            placeholder="Countries (DE,AT)"
            value={countries}
            onChange={(e) => setCountries(e.target.value)}
          />
          <input
            placeholder="Rate name"
            value={rateName}
            onChange={(e) => setRateName(e.target.value)}
          />
          <input
            placeholder="Price cents"
            value={ratePrice}
            onChange={(e) => setRatePrice(e.target.value)}
          />
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={!name || create.isPending}
            onClick={() => create.mutate()}
          >
            Create zone
          </button>
        </div>
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
