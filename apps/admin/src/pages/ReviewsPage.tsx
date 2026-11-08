import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api";

export function ReviewsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["reviews"],
    queryFn: () =>
      api.get<
        {
          id: string;
          rating: number;
          body: string;
          authorName: string;
          product: { translations: { title: string }[] };
        }[]
      >("/admin/reviews"),
  });

  const moderate = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: "approve" | "reject";
    }) => api.post(`/admin/reviews/${id}/${action}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews"] }),
  });

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>Reviews</h1>
      </div>
      <div className="admin-panel admin-stack">
        {(data ?? []).map((r) => (
          <div key={r.id}>
            <strong>
              {r.product.translations[0]?.title} · {r.rating}/5 · {r.authorName}
            </strong>
            <p>{r.body}</p>
            <div className="admin-actions">
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => moderate.mutate({ id: r.id, action: "approve" })}
              >
                Approve
              </button>
              <button
                type="button"
                className="admin-btn"
                onClick={() => moderate.mutate({ id: r.id, action: "reject" })}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
        {!data?.length ? (
          <p className="admin-muted">No pending reviews</p>
        ) : null}
      </div>
    </div>
  );
}
