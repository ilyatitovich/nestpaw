import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api } from "../api";

export function DiscountsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["discounts"],
    queryFn: () =>
      api.get<
        { id: string; code: string; type: string; value: number; active: boolean }[]
      >("/admin/discounts"),
  });
  const [code, setCode] = useState("");
  const [value, setValue] = useState("10");

  const create = useMutation({
    mutationFn: () =>
      api.post("/admin/discounts", {
        code,
        type: "percentage",
        value: Number(value),
        active: true,
      }),
    onSuccess: () => {
      setCode("");
      qc.invalidateQueries({ queryKey: ["discounts"] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Discounts</h1>
      </div>
      <form className="admin-panel admin-form" onSubmit={onSubmit}>
        <label>
          Code
          <input value={code} onChange={(e) => setCode(e.target.value)} required />
        </label>
        <label>
          Percent
          <input value={value} onChange={(e) => setValue(e.target.value)} required />
        </label>
        <button className="admin-btn admin-btn--primary">Create</button>
      </form>
      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Value</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((d) => (
              <tr key={d.id}>
                <td className="admin-mono">{d.code}</td>
                <td>{d.type}</td>
                <td>{d.value}</td>
                <td>{d.active ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
