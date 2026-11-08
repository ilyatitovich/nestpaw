import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api";

export function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<Record<string, unknown>>("/settings"),
  });
  const [threshold, setThreshold] = useState("4900");

  useEffect(() => {
    const v = data?.free_shipping_threshold_cents;
    if (typeof v === "number") setThreshold(String(v));
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api.post("/admin/settings", {
        key: "free_shipping_threshold_cents",
        value: Number(threshold),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Settings</h1>
      </div>
      <div className="admin-panel admin-stack">
        <label>
          Free shipping threshold (cents)
          <input
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={() => save.mutate()}
        >
          Save threshold
        </button>
      </div>
      <div className="admin-panel">
        <pre className="admin-mono" style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}
