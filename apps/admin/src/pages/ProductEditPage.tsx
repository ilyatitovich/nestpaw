import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

export function ProductEditPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const existing = useQuery({
    queryKey: ["product", id],
    enabled: !isNew,
    queryFn: () => api.get<Record<string, unknown>>(`/admin/products/${id}`),
  });

  const [titleEn, setTitleEn] = useState("");
  const [titleDe, setTitleDe] = useState("");
  const [slugEn, setSlugEn] = useState("");
  const [slugDe, setSlugDe] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("19.99");
  const [stock, setStock] = useState("10");
  const [status, setStatus] = useState("draft");

  useEffect(() => {
    if (!existing.data) return;
    const p = existing.data as {
      status: string;
      translations: { locale: string; title: string; slug: string; description: string }[];
      variants: { sku: string; price: number; inventory?: { quantity: number } }[];
    };
    const en = p.translations.find((t) => t.locale === "en");
    const de = p.translations.find((t) => t.locale === "de");
    setTitleEn(en?.title ?? "");
    setTitleDe(de?.title ?? "");
    setSlugEn(en?.slug ?? "");
    setSlugDe(de?.slug ?? "");
    setDescription(en?.description ?? "");
    setStatus(p.status);
    const v = p.variants[0];
    if (v) {
      setSku(v.sku);
      setPrice((v.price / 100).toFixed(2));
      setStock(String(v.inventory?.quantity ?? 0));
    }
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        status,
        translations: [
          {
            locale: "en",
            title: titleEn,
            slug: slugEn || titleEn.toLowerCase().replace(/\s+/g, "-"),
            description,
          },
          {
            locale: "de",
            title: titleDe || titleEn,
            slug: slugDe || slugEn || titleEn.toLowerCase().replace(/\s+/g, "-"),
            description,
          },
        ],
        variants: [
          {
            sku,
            price: Math.round(Number(price) * 100),
            stock: Number(stock),
            stockPolicy: "deny" as const,
          },
        ],
      };
      if (isNew) return api.post("/admin/products", payload);
      return api.patch(`/admin/products/${id}`, payload);
    },
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["admin-products-all"] });
      const created = res as { id?: string };
      navigate(`/products/${created.id ?? id}`);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>{isNew ? "New product" : "Edit product"}</h1>
      </div>
      <form className="admin-panel admin-form" onSubmit={onSubmit}>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <label>
          Title (EN)
          <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} required />
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
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          SKU
          <input value={sku} onChange={(e) => setSku(e.target.value)} required />
        </label>
        <label>
          Price (EUR)
          <input value={price} onChange={(e) => setPrice(e.target.value)} required />
        </label>
        <label>
          Stock
          <input value={stock} onChange={(e) => setStock(e.target.value)} required />
        </label>
        {save.isError ? (
          <p style={{ color: "var(--danger)" }}>
            {(save.error as Error).message}
          </p>
        ) : null}
        <button className="admin-btn admin-btn--primary" disabled={save.isPending}>
          Save
        </button>
      </form>
    </div>
  );
}
