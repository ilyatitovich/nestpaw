import {
  emptyDoc,
  parseTipTapDoc,
  type TipTapDoc,
} from "@online-store/rich-text";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/api";
import { ProductBodyEditor } from "@/components/ProductBodyEditor";

type Translation = {
  locale: string;
  title: string;
  slug: string;
  description: string;
  body?: TipTapDoc | null;
};
type Collection = {
  id: string;
  translations: { locale: string; title: string }[];
};
type Product = {
  status: string;
  translations: Translation[];
  variants: {
    sku: string;
    price: number;
    inventory?: { quantity: number };
  }[];
  media: { url: string; alt: string }[];
  metafields: { namespace: string; key: string; value: unknown }[];
  collections: { collectionId: string }[];
};

const SPECIES = ["dog", "cat", "small_pet"] as const;
const LIFE_STAGES = ["puppy_kitten", "adult", "senior", "all"] as const;
const PRODUCT_TYPES = [
  "food",
  "treats",
  "toys",
  "care",
  "litter",
  "beds_travel",
  "bowls",
] as const;
const SIZE_CLASSES = ["xs", "s", "m", "l", "xl", "na"] as const;

function metaValue(
  metafields: Product["metafields"] | undefined,
  key: string,
): string {
  const m = metafields?.find((x) => x.namespace === "pet" && x.key === key);
  return typeof m?.value === "string" ? m.value : "";
}

export function ProductEditPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const existing = useQuery({
    queryKey: ["product", id],
    enabled: !isNew,
    queryFn: () => api.get<Product>(`/admin/products/${id}`),
  });
  const collections = useQuery({
    queryKey: ["admin-collections"],
    queryFn: () => api.get<Collection[]>("/admin/collections"),
  });

  const [titleEn, setTitleEn] = useState("");
  const [titleDe, setTitleDe] = useState("");
  const [slugEn, setSlugEn] = useState("");
  const [slugDe, setSlugDe] = useState("");
  const [description, setDescription] = useState("");
  const [bodyEn, setBodyEn] = useState<TipTapDoc>(emptyDoc);
  const [bodyDe, setBodyDe] = useState<TipTapDoc>(emptyDoc);
  const [bodyLocale, setBodyLocale] = useState<"en" | "de">("en");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("19.99");
  const [stock, setStock] = useState("10");
  const [status, setStatus] = useState("draft");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [species, setSpecies] = useState("dog");
  const [lifeStage, setLifeStage] = useState("all");
  const [productType, setProductType] = useState("food");
  const [sizeClass, setSizeClass] = useState("na");

  useEffect(() => {
    if (!existing.data) return;
    const p = existing.data;
    const en = p.translations.find((t) => t.locale === "en");
    const de = p.translations.find((t) => t.locale === "de");
    setTitleEn(en?.title ?? "");
    setTitleDe(de?.title ?? "");
    setSlugEn(en?.slug ?? "");
    setSlugDe(de?.slug ?? "");
    setDescription(en?.description ?? "");
    setBodyEn(parseTipTapDoc(en?.body) ?? emptyDoc);
    setBodyDe(parseTipTapDoc(de?.body) ?? emptyDoc);
    setStatus(p.status);
    const v = p.variants[0];
    if (v) {
      setSku(v.sku);
      setPrice((v.price / 100).toFixed(2));
      setStock(String(v.inventory?.quantity ?? 0));
    }
    const img = p.media[0];
    if (img) {
      setImageUrl(img.url);
      setImageAlt(img.alt);
    }
    setCollectionIds(p.collections.map((c) => c.collectionId));
    setSpecies(metaValue(p.metafields, "species") || "dog");
    setLifeStage(metaValue(p.metafields, "life_stage") || "all");
    setProductType(metaValue(p.metafields, "product_type") || "food");
    setSizeClass(metaValue(p.metafields, "size_class") || "na");
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
            body: bodyEn,
          },
          {
            locale: "de",
            title: titleDe || titleEn,
            slug:
              slugDe || slugEn || titleEn.toLowerCase().replace(/\s+/g, "-"),
            description,
            body: bodyDe,
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
        collectionIds,
        media: imageUrl
          ? [{ url: imageUrl, alt: imageAlt || titleEn, position: 0 }]
          : [],
        metafields: [
          {
            namespace: "pet",
            key: "species",
            type: "string" as const,
            value: species,
          },
          {
            namespace: "pet",
            key: "life_stage",
            type: "string" as const,
            value: lifeStage,
          },
          {
            namespace: "pet",
            key: "product_type",
            type: "string" as const,
            value: productType,
          },
          {
            namespace: "pet",
            key: "size_class",
            type: "string" as const,
            value: sizeClass,
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

  function toggleCollection(cid: string) {
    setCollectionIds((prev) =>
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid],
    );
  }

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
          Short description
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="admin-body-field">
          <div className="admin-body-field__header">
            <span>Product body</span>
            <div className="admin-body-field__locales" role="group" aria-label="Body locale">
              <button
                type="button"
                className={bodyLocale === "en" ? "is-active" : ""}
                onClick={() => setBodyLocale("en")}
              >
                EN
              </button>
              <button
                type="button"
                className={bodyLocale === "de" ? "is-active" : ""}
                onClick={() => setBodyLocale("de")}
              >
                DE
              </button>
            </div>
          </div>
          {bodyLocale === "en" ? (
            <ProductBodyEditor value={bodyEn} onChange={setBodyEn} />
          ) : (
            <ProductBodyEditor value={bodyDe} onChange={setBodyDe} />
          )}
        </div>
        <label>
          SKU
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            required
          />
        </label>
        <label>
          Price (EUR)
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </label>
        <label>
          Stock
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            required
          />
        </label>
        <label>
          Image URL
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://images.unsplash.com/..."
          />
        </label>
        <label>
          Image alt
          <input
            value={imageAlt}
            onChange={(e) => setImageAlt(e.target.value)}
          />
        </label>
        <label>
          Species
          <select value={species} onChange={(e) => setSpecies(e.target.value)}>
            {SPECIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Life stage
          <select
            value={lifeStage}
            onChange={(e) => setLifeStage(e.target.value)}
          >
            {LIFE_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Product type
          <select
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
          >
            {PRODUCT_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Size class
          <select
            value={sizeClass}
            onChange={(e) => setSizeClass(e.target.value)}
          >
            {SIZE_CLASSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Categories</legend>
          <div className="admin-checklist">
            {(collections.data ?? []).map((c) => {
              const t =
                c.translations.find((x) => x.locale === "en") ??
                c.translations[0];
              return (
                <label key={c.id} className="admin-check">
                  <input
                    type="checkbox"
                    checked={collectionIds.includes(c.id)}
                    onChange={() => toggleCollection(c.id)}
                  />
                  {t?.title ?? c.id}
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
          type="submit"
          className="admin-btn admin-btn--primary"
          disabled={save.isPending}
        >
          Save
        </button>
      </form>
    </div>
  );
}
