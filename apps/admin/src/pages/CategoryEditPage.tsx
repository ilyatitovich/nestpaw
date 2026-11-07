import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

type Translation = {
  locale: string;
  title: string;
  slug: string;
  description: string;
};
type Collection = {
  id: string;
  parentId: string | null;
  translations: Translation[];
  products: { productId: string }[];
};
type ProductRow = {
  id: string;
  translations: { locale: string; title: string }[];
};

export function CategoryEditPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const existing = useQuery({
    queryKey: ["admin-collection", id],
    enabled: !isNew,
    queryFn: () => api.get<Collection>(`/admin/collections/${id}`),
  });
  const allCollections = useQuery({
    queryKey: ["admin-collections"],
    queryFn: () => api.get<Collection[]>("/admin/collections"),
  });
  const allProducts = useQuery({
    queryKey: ["admin-products-all"],
    queryFn: () =>
      api.get<{ items: ProductRow[] }>("/admin/products?take=100"),
  });

  const [titleEn, setTitleEn] = useState("");
  const [titleDe, setTitleDe] = useState("");
  const [slugEn, setSlugEn] = useState("");
  const [slugDe, setSlugDe] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);

  useEffect(() => {
    if (!existing.data) return;
    const c = existing.data;
    const en = c.translations.find((t) => t.locale === "en");
    const de = c.translations.find((t) => t.locale === "de");
    setTitleEn(en?.title ?? "");
    setTitleDe(de?.title ?? "");
    setSlugEn(en?.slug ?? "");
    setSlugDe(de?.slug ?? "");
    setDescription(en?.description ?? "");
    setParentId(c.parentId ?? "");
    setProductIds(c.products.map((p) => p.productId));
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const translations = [
        {
          locale: "en" as const,
          title: titleEn,
          slug: slugEn || titleEn.toLowerCase().replace(/\s+/g, "-"),
          description,
        },
        {
          locale: "de" as const,
          title: titleDe || titleEn,
          slug: slugDe || slugEn || titleEn.toLowerCase().replace(/\s+/g, "-"),
          description,
        },
      ];
      if (isNew) {
        return api.post<Collection>("/admin/collections", {
          parentId: parentId || null,
          translations,
          productIds,
        });
      }
      await api.patch(`/admin/collections/${id}`, {
        parentId: parentId || null,
        translations,
      });
      return api.put(`/admin/collections/${id}/products`, { productIds });
    },
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["admin-collections"] });
      const created = res as { id?: string };
      navigate(`/categories/${created.id ?? id}`);
    },
  });

  function toggleProduct(pid: string) {
    setProductIds((prev) =>
      prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid],
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  const parentOptions = (allCollections.data ?? []).filter((c) => c.id !== id);

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>{isNew ? "New category" : "Edit category"}</h1>
      </div>
      <form className="admin-panel admin-form" onSubmit={onSubmit}>
        <label>
          Parent
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— none (top level) —</option>
            {parentOptions.map((c) => {
              const t =
                c.translations.find((x) => x.locale === "en") ??
                c.translations[0];
              return (
                <option key={c.id} value={c.id}>
                  {t?.title}
                </option>
              );
            })}
          </select>
        </label>
        <label>
          Title (EN)
          <input
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            required
          />
        </label>
        <label>
          Title (DE)
          <input value={titleDe} onChange={(e) => setTitleDe(e.target.value)} />
        </label>
        <label>
          Slug (EN)
          <input value={slugEn} onChange={(e) => setSlugEn(e.target.value)} />
        </label>
        <label>
          Slug (DE)
          <input value={slugDe} onChange={(e) => setSlugDe(e.target.value)} />
        </label>
        <label>
          Description
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>Products in category</legend>
          <div className="admin-checklist">
            {(allProducts.data?.items ?? []).map((p) => {
              const t =
                p.translations.find((x) => x.locale === "en") ??
                p.translations[0];
              return (
                <label key={p.id} className="admin-check">
                  <input
                    type="checkbox"
                    checked={productIds.includes(p.id)}
                    onChange={() => toggleProduct(p.id)}
                  />
                  {t?.title ?? p.id}
                </label>
              );
            })}
          </div>
        </fieldset>
        {save.isError ? (
          <p style={{ color: "var(--danger)" }}>
            {(save.error as Error).message}
          </p>
        ) : null}
        <button
          className="admin-btn admin-btn--primary"
          disabled={save.isPending}
        >
          Save
        </button>
      </form>
    </div>
  );
}
