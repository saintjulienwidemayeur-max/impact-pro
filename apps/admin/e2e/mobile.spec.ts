import { expect, test } from "@playwright/test";
import { loginAs, resetMock } from "./helpers";

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name !== "mobile", "mobile only");
  await resetMock();
});

test("phone: menu opens, pages fit the viewport without horizontal scroll", async ({ page }) => {
  await loginAs(page, "admin");
  await page.getByRole("button", { name: /ouvrir le menu/i }).click();
  await page.getByTestId("sidebar-nav").getByRole("link", { name: "Commandes", exact: true }).click();
  await expect(page.getByTestId("orders-rows")).toBeVisible();
  for (const path of ["/", "/commandes", "/clients", "/devis", "/factures", "/parametres", "/utilisateurs"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }
});
