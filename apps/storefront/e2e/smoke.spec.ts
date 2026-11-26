import { expect, test } from "@playwright/test";

test.describe("storefront smoke", () => {
  test("homepage renders key sections", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Impact Pro/);
    await expect(page.getByRole("img", { name: "Impact Pro" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/sur tout/i);
    await expect(page.getByRole("heading", { name: "Produits populaires" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Comment ça marche" })).toBeVisible();
    await expect(page.locator("footer")).toContainText("Impact Pro LLC");
  });

  test("add to cart increments the header count and persists", async ({ page }) => {
    await page.goto("/");
    const count = page.getByTestId("cart-count");
    await expect(count).toHaveText("0");
    await page.getByRole("button", { name: /Ajouter Tasse céramique 11 oz au panier/ }).click();
    await expect(count).toHaveText("12"); // minimum quantity for mugs
    await page.goto("/panier");
    await expect(page.getByRole("link", { name: "Tasse céramique 11 oz" })).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("12");
  });

  test("quote form validates required fields and submits", async ({ page }) => {
    await page.goto("/devis");
    await page.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(page.getByText("Indiquez votre nom.")).toBeVisible();
    await expect(page.getByText("Adresse courriel invalide.")).toBeVisible();
    await expect(page.getByLabel(/Nom complet/)).toBeFocused();

    await page.getByLabel(/Nom complet/).fill("Marie Joseph");
    await page.getByLabel(/Téléphone/).fill("+509 3700 0000");
    await page.getByLabel(/Courriel/).fill("marie@example.com");
    await page.getByLabel(/Produits souhaités/).fill("50 polos brodés");
    await page.getByLabel(/Quantité totale/).fill("50");
    await page.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(page.getByText("Merci, votre demande est bien reçue !")).toBeVisible();
  });

  test("quote API rejects invalid payloads", async ({ request }) => {
    const res = await request.post("/api/devis", { multipart: { name: "x" } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("product search filters the catalog", async ({ page }) => {
    await page.goto("/produits?q=casquette");
    await expect(page.getByText(/1 produit/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Casquette brodée" })).toBeVisible();
  });
});
