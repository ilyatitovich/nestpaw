export const locales = ["en", "de"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const ui = {
  en: {
    "nav.shop": "Shop",
    "nav.cart": "Cart",
    "nav.about": "About",
    "home.cta": "Shop the collection",
    "home.lead": "Quiet goods for daily rituals.",
    "product.add": "Add to cart",
    "product.from": "From",
    "cart.title": "Your cart",
    "cart.checkout": "Checkout",
    "cart.empty": "Your cart is empty.",
    "cart.discount": "Discount code",
    "cart.apply": "Apply",
    "search.placeholder": "Search products",
    "footer.privacy": "Privacy",
    "account.login": "Account",
  },
  de: {
    "nav.shop": "Shop",
    "nav.cart": "Warenkorb",
    "nav.about": "Über uns",
    "home.cta": "Kollektion entdecken",
    "home.lead": "Ruhige Dinge für den Alltag.",
    "product.add": "In den Warenkorb",
    "product.from": "Ab",
    "cart.title": "Warenkorb",
    "cart.checkout": "Zur Kasse",
    "cart.empty": "Ihr Warenkorb ist leer.",
    "cart.discount": "Rabattcode",
    "cart.apply": "Anwenden",
    "search.placeholder": "Produkte suchen",
    "footer.privacy": "Datenschutz",
    "account.login": "Konto",
  },
} as const;

export function t(locale: string, key: keyof (typeof ui)["en"]) {
  const l = (locales.includes(locale as Locale) ? locale : defaultLocale) as Locale;
  return ui[l][key] ?? ui.en[key];
}

export function localizePath(locale: string, path: string) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean === "/" ? "" : clean}`;
}
