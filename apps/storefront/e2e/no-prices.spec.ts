import { expect, test } from "@playwright/test";

// Runs only when the site is built with prices hidden (NEXT_PUBLIC_SHOW_PRICES unset/false).
test.skip(process.env.NEXT_PUBLIC_SHOW_PRICES === "true" || !process.env.NO_PRICES_CHECK, "prices-hidden build only");

test("no price anywhere on the public catalogue and payment logos are shown", async ({ page }) => {
  for (const url of ["/", "/produits", "/personnaliser", "/produits/tasse-personnalisee"]) {
    await page.goto(url);
    await expect(page.locator("body")).not.toContainText(/\d\s?HTG/);
  }
  await page.goto("/");
  await expect(page.getByRole("list", { name: "Moyens de paiement acceptés" }).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/MonCash|NatCash/);
});
