const { test, expect } = require("@playwright/test");
const path = require("path");

test("página mostra o bookmarklet", async ({ page }) => {
  await page.goto("file://" + path.resolve(__dirname, "../../index.html"));
  const bm = await page.locator("#bm").inputValue();
  expect(bm.startsWith("javascript:")).toBe(true);
  expect(bm).toContain("S2-DaPaz/Gartic-helper");
  expect(bm).toContain("/helper.js");
});

test("bookmarklet carrega do @main quando a API do GitHub recusa", async ({ page }) => {
  await page.goto("file://" + path.resolve(__dirname, "../../index.html"));
  const bm = await page.locator("#bm").inputValue();
  await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 403, contentType: "application/json", body: '{"message":"API rate limit exceeded"}', headers: { "access-control-allow-origin": "*" } }));
  await page.route("https://cdn.jsdelivr.net/**", (r) => r.fulfill({ status: 200, contentType: "application/javascript", path: path.resolve(__dirname, "../../helper.js") }));
  await page.goto("file://" + path.resolve(__dirname, "../fixtures/gartic.html"));
  await page.evaluate(decodeURIComponent(bm.replace(/^javascript:/, "")));
  await expect(page.locator('script[src*="@main/helper.js"]')).toHaveCount(1);
  await expect(page.locator("#gh-bolinha")).toBeVisible();
});
