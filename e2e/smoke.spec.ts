import { expect, test } from "@playwright/test";

const API = process.env.PUBLIC_API_URL ?? "http://localhost:3001";
const STORE = process.env.PUBLIC_STORE_URL ?? "http://localhost:4321";

test.describe("commerce smoke", () => {
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

  test("storefront home responds when running", async ({ page }) => {
    test.skip(!process.env.E2E_STOREFRONT, "Set E2E_STOREFRONT=1 with storefront running");
    await page.goto(`${STORE}/en/`);
    await expect(page.locator(".site-header__brand")).toContainText("Online Store");
  });
});
