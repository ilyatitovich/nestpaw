import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api";

export function TaxPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["tax-rates"],
    queryFn: () =>
      api.get<
        { id: string; country: string; taxClass: string; name: string; rateBps: number }[]
      >("/admin/tax"),
  });

  const [country, setCountry] = useState("DE");
  const [taxClass, setTaxClass] = useState("standard");
  const [name, setName] = useState("Germany VAT 19%");
  const [rateBps, setRateBps] = useState("1900");

  const upsert = useMutation({
    mutationFn: () =>
      api.post("/admin/tax", {
        country,
        taxClass,
        name,
        rateBps: Number(rateBps),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax-rates"] }),
  });

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Tax rates</h1>
      </div>
      <div className="admin-panel admin-stack">
        <div className="admin-actions" style={{ flexWrap: "wrap" }}>
          <input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} />
          <select value={taxClass} onChange={(e) => setTaxClass(e.target.value)}>
            <option value="standard">standard</option>
            <option value="reduced">reduced</option>
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <input value={rateBps} onChange={(e) => setRateBps(e.target.value)} />
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={() => upsert.mutate()}
          >
            Save rate
          </button>
        </div>
        {isLoading ? (
          <p className="admin-muted">Loading…</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Class</th>
                <th>Name</th>
                <th>bps</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{r.country}</td>
                  <td>{r.taxClass}</td>
                  <td>{r.name}</td>
                  <td>{r.rateBps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
