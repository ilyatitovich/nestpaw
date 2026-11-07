import { expect, test } from "@playwright/test";

const API = process.env.PUBLIC_API_URL ?? "http://localhost:3001";
const STORE = process.env.PUBLIC_STORE_URL ?? "http://localhost:4321";

test.describe("commerce smoke", () => {
  test.describe("api", () => {
    test.skip(
      process.env.E2E_API !== "1",
      "Set E2E_API=1 with API running (seeded DB)",
    );

    test("health ready", async ({ request }) => {
      const res = await request.get(`${API}/health/live`);
      expect(res.ok()).toBeTruthy();
    });

    test("public products list", async ({ request }) => {
      const res = await request.get(`${API}/products`);
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(Array.isArray(body.items)).toBeTruthy();
    });

    test("cart → checkout → mock pay marks order paid", async ({
      request,
    }) => {
      const products = await request.get(`${API}/products`);
      expect(products.ok()).toBeTruthy();
      const catalog = await products.json();
      const variantId = catalog.items?.[0]?.variants?.[0]?.id as
        | string
        | undefined;
      expect(variantId).toBeTruthy();

      const cartRes = await request.get(`${API}/cart`);
      expect(cartRes.ok()).toBeTruthy();
      const cartToken =
        cartRes.headers()["x-cart-token"] ?? (await cartRes.json()).token;

      const add = await request.post(`${API}/cart/items`, {
        headers: {
          "Content-Type": "application/json",
          "X-Cart-Token": cartToken,
        },
        data: { variantId, quantity: 1 },
      });
      expect(add.ok()).toBeTruthy();

      const checkout = await request.post(`${API}/checkout`, {
        headers: {
          "Content-Type": "application/json",
          "X-Cart-Token": cartToken,
          "Idempotency-Key": `e2e-${Date.now()}`,
        },
        data: {
          shippingAddress: {
            firstName: "E2E",
            lastName: "Buyer",
            email: "e2e@example.com",
            line1: "Teststrasse 1",
            city: "Berlin",
            postalCode: "10115",
            country: "DE",
          },
          locale: "en",
          currency: "EUR",
          successUrl: `${STORE}/en/checkout/success`,
          cancelUrl: `${STORE}/en/cart`,
        },
      });
      expect(checkout.ok()).toBeTruthy();
      const { orderId, checkoutUrl } = await checkout.json();
      expect(orderId).toBeTruthy();
      expect(checkoutUrl).toContain("cs_test_mock_");

      const mock = await request.post(`${API}/payments/mock-complete`, {
        data: { sessionId: `cs_test_mock_${orderId}` },
      });
      expect(mock.ok()).toBeTruthy();
      const mockBody = await mock.json();
      expect(mockBody.ok).toBeTruthy();
    });

    test("mock-complete rejects when mocks disabled", async ({ request }) => {
      test.skip(
        process.env.E2E_MOCK_DISABLED !== "1",
        "Set E2E_MOCK_DISABLED=1 against an API with ALLOW_MOCK_PAYMENTS=false",
      );
      const res = await request.post(`${API}/payments/mock-complete`, {
        data: { sessionId: "cs_test_mock_x" },
      });
      expect(res.status()).toBe(403);
    });
  });

  test.describe("storefront", () => {
    test.skip(
      process.env.E2E_STOREFRONT !== "1",
      "Set E2E_STOREFRONT=1 with storefront running",
    );

    test("storefront home responds when running", async ({ page }) => {
      await page.goto(`${STORE}/en/`);
      await expect(page.locator(".site-header__brand")).toContainText(
        "Online Store",
      );
    });
  });
});
