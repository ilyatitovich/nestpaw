import { apiGet } from "./api";

/** Empty props keep the page component's props type as `{}`, not `never`. */
type SlugPath = {
  params: { slug: string };
  props: Record<string, never>;
};

function slugPath(slug: string): SlugPath {
  return { params: { slug }, props: {} };
}

const CMS_SLUGS = [
  "about",
  "privacy",
  "cookies",
  "shipping",
  "returns",
  "terms",
  "contact",
  "impressum",
  "widerruf",
  "home",
] as const;

export function cmsPagePaths() {
  return CMS_SLUGS.map((slug) => slugPath(slug));
}

export async function productPaths(locale: string) {
  try {
    const data = await apiGet<{
      items: { translations: { locale: string; slug: string }[] }[];
    }>(`/products?locale=${locale}&take=100`);
    const paths = data.items.flatMap((product) => {
      const translation = product.translations.find(
        (item) => item.locale === locale,
      );
      return translation ? [slugPath(translation.slug)] : [];
    });
    if (paths.length) return paths;
  } catch {
    // API may be offline during build
  }
  return [
    slugPath(
      locale === "de" ? "wiesen-adult-trockenfutter" : "meadow-adult-dry-food",
    ),
  ];
}

export async function collectionPaths(locale: string) {
  const paths: SlugPath[] = [];
  const seen = new Set<string>();
  const push = (slug: string) => {
    if (seen.has(slug)) return;
    seen.add(slug);
    paths.push(slugPath(slug));
  };
  try {
    const collections = await apiGet<
      {
        translations: { locale: string; slug: string }[];
        children?: { translations: { locale: string; slug: string }[] }[];
      }[]
    >(`/collections?locale=${locale}`);
    for (const collection of collections) {
      const translation =
        collection.translations.find((item) => item.locale === locale) ??
        collection.translations[0];
      if (translation?.slug) push(translation.slug);
      for (const child of collection.children ?? []) {
        const childTranslation =
          child.translations.find((item) => item.locale === locale) ??
          child.translations[0];
        if (childTranslation?.slug) push(childTranslation.slug);
      }
    }
  } catch {
    // API offline during build
  }
  if (!paths.length) {
    for (const slug of [
      "dogs",
      "cats",
      "small-pets",
      "hunde",
      "katzen",
      "kleintiere",
    ]) {
      push(slug);
    }
  }
  return paths;
}
