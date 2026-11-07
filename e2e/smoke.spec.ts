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

    test("public products list has Nestpaw catalog", async ({ request }) => {
      const res = await request.get(`${API}/products`);
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(Array.isArray(body.items)).toBeTruthy();
      expect(body.items.length).toBeGreaterThanOrEqual(10);
    });

    test("dogs collection hub returns children", async ({ request }) => {
      const res = await request.get(`${API}/collections/en/dogs`);
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.children?.length).toBeGreaterThan(0);
    });

    test("admin can create category and assign product", async ({
      request,
    }) => {
      const login = await request.post(`${API}/auth/login`, {
        data: {
          email: process.env.ADMIN_EMAIL ?? "admin@example.com",
          password: process.env.ADMIN_PASSWORD ?? "ChangeMe123!",
        },
      });
      expect(login.ok()).toBeTruthy();
      const { accessToken } = await login.json();

      const products = await request.get(`${API}/admin/products?take=1`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(products.ok()).toBeTruthy();
      const catalog = await products.json();
      const productId = catalog.items?.[0]?.id as string | undefined;
      expect(productId).toBeTruthy();

      const slug = `e2e-cat-${Date.now()}`;
      const created = await request.post(`${API}/admin/collections`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          translations: [
            {
              locale: "en",
              title: "E2E Category",
              slug,
              description: "Playwright category",
            },
            {
              locale: "de",
              title: "E2E Kategorie",
              slug: `${slug}-de`,
              description: "Playwright Kategorie",
            },
          ],
          productIds: [productId],
        },
      });
      expect(created.ok()).toBeTruthy();
      const collection = await created.json();
      expect(collection.id).toBeTruthy();

      const publicList = await request.get(
        `${API}/products?collection=${slug}&locale=en`,
      );
      expect(publicList.ok()).toBeTruthy();
      const listed = await publicList.json();
      expect(
        listed.items.some((p: { id: string }) => p.id === productId),
      ).toBeTruthy();

      await request.delete(`${API}/admin/collections/${collection.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    });

    test("cart → checkout → mock pay marks order paid", async ({ request }) => {
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

    test("Nestpaw home and dogs browse", async ({ page }) => {
      await page.goto(`${STORE}/en/`);
      await expect(page.locator(".site-header__brand")).toContainText(
        "Nestpaw",
      );
      await expect(page.locator(".hero__brand")).toContainText("Nestpaw");
      await page.goto(`${STORE}/en/collections/dogs`);
      await expect(page.locator(".section__title").first()).toContainText(
        "Dogs",
      );
      await expect(page.locator(".product-card").first()).toBeVisible();
    });

    test("PDP add to cart path", async ({ page }) => {
      await page.goto(`${STORE}/en/shop`);
      const first = page.locator(".product-card").first();
      await expect(first).toBeVisible();
      await first.click();
      await expect(page.locator(".pdp__title")).toBeVisible();
      await page.getByRole("button", { name: /add to cart/i }).click();
      await expect(page).toHaveURL(/\/en\/cart/);
    });
  });
});
