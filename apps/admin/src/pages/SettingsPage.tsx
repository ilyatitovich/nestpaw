import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export function SettingsPage() {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<Record<string, unknown>>("/settings"),
  });

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Settings</h1>
      </div>
      <div className="admin-panel">
        <pre className="admin-mono" style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}
