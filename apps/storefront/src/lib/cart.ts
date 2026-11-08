export const CART_TOKEN_KEY = "cart_token";
export const CART_OPEN_EVENT = "nestpaw:cart-open";
export const CART_UPDATED_EVENT = "nestpaw:cart-updated";

export type CartLine = {
  id: string;
  quantity: number;
  variant: {
    id?: string;
    sku?: string;
    price: number;
    compareAtPrice?: number | null;
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
    product: {
      id?: string;
      translations: { locale: string; title: string; slug?: string }[];
      media?: { url: string; alt: string }[];
    };
  };
};

export type Cart = {
  token: string;
  lines: CartLine[];
  totals: {
    subtotal: number;
    discountTotal: number;
    total: number;
    currency: string;
  };
  discountCode?: string | null;
};

export function getCartToken(): string | null {
  return localStorage.getItem(CART_TOKEN_KEY);
}

export function setCartToken(token: string) {
  localStorage.setItem(CART_TOKEN_KEY, token);
}

export function persistCartToken(res: Response, cart: Cart) {
  const header = res.headers.get("X-Cart-Token");
  if (header) setCartToken(header);
  else if (cart.token) setCartToken(cart.token);
}

export function cartHeaders(token?: string | null): HeadersInit {
  return token ? { "X-Cart-Token": token } : {};
}

export async function fetchCart(apiUrl: string): Promise<Cart> {
  const token = getCartToken();
  const res = await fetch(`${apiUrl}/cart`, {
    headers: cartHeaders(token),
  });
  if (!res.ok) throw new Error("Could not load cart");
  const data = (await res.json()) as Cart;
  persistCartToken(res, data);
  return data;
}

export async function patchCartLine(
  apiUrl: string,
  token: string,
  lineId: string,
  quantity: number,
): Promise<Cart> {
  const res = await fetch(`${apiUrl}/cart/items/${lineId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...cartHeaders(token),
    },
    body: JSON.stringify({ quantity }),
  });
  if (!res.ok) throw new Error("Could not update cart");
  const data = (await res.json()) as Cart;
  persistCartToken(res, data);
  return data;
}

export async function addCartItem(
  apiUrl: string,
  token: string | null,
  variantId: string,
  quantity = 1,
): Promise<Cart> {
  const res = await fetch(`${apiUrl}/cart/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...cartHeaders(token),
    },
    body: JSON.stringify({ variantId, quantity }),
  });
  if (!res.ok) throw new Error("Could not add to cart");
  const data = (await res.json()) as Cart;
  persistCartToken(res, data);
  return data;
}

export async function applyCartDiscount(
  apiUrl: string,
  token: string,
  code: string,
): Promise<Cart> {
  const res = await fetch(`${apiUrl}/cart/discount`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...cartHeaders(token),
    },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error("Invalid code");
  const data = (await res.json()) as Cart;
  persistCartToken(res, data);
  return data;
}

export function dispatchCartOpen() {
  window.dispatchEvent(new CustomEvent(CART_OPEN_EVENT));
}

export function dispatchCartUpdated() {
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
}

export function lineCount(cart: Cart | null): number {
  if (!cart) return 0;
  return cart.lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function lineTitle(line: CartLine, locale: string): string {
  return (
    line.variant.product.translations.find((t) => t.locale === locale)?.title ??
    line.variant.product.translations[0]?.title ??
    "Item"
  );
}

export function lineVariantLabel(line: CartLine): string | null {
  const options = [line.variant.option1, line.variant.option2, line.variant.option3]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v));
  if (!options.length) return null;
  return options.join(" / ").toUpperCase();
}

export function formatCartMoney(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}
