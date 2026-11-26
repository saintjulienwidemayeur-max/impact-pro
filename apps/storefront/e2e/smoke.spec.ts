import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end tests. Catalog, upload and order tests run against the REAL API
 * (`NEXT_PUBLIC_API_URL`, default http://localhost:4000) and are skipped when it is unreachable.
 * The only mocked response is the 422 in "maps API errors", to exercise the error UI deterministically.
 */
const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
const LOGO = path.join(__dirname, "fixtures", "test-logo.png");

let apiUp = false;
test.beforeAll(async ({ request }) => {
  try {
    apiUp = (await request.get(`${API}/api/v1/health`, { timeout: 5000 })).ok();
  } catch {
    apiUp = false;
  }
});

async function customizeMug(page: Page, qty = "24") {
  await page.goto("/personnaliser/tasse-ceramique-11oz");
  await page.getByTestId("logo-input").setInputFiles(LOGO);
  await expect(page.getByTestId("logo-uploaded")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("logo-overlay").locator("img")).toBeVisible();
  await page.locator("#cz-quantity").fill(qty);
}

test.describe("storefront", () => {
  test("homepage renders key sections with real photos", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Impact Pro/);
    await expect(page.getByRole("img", { name: "Impact Pro" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/sur tout/i);
    await expect(page.getByRole("heading", { name: "Produits populaires" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Votre logo sur tout votre kit" })).toBeVisible();
    await expect(page.locator('img[src*="kit-promotionnel"]').first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Comment ça marche" })).toBeVisible();
    await expect(page.locator("footer")).toContainText("Impact Pro LLC");
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
    const res = await request.post("/api/devis", { data: { name: "x" } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  test("customizer rejects unsupported files client-side", async ({ page }) => {
    test.skip(!apiUp, "API not reachable");
    await page.goto("/personnaliser/tasse-ceramique-11oz");
    await page.getByTestId("logo-input").setInputFiles({ name: "logo.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
    await expect(page.getByText("Format accepté : PNG, JPG, WEBP ou PDF.")).toBeVisible();
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("0");
  });

  test("customizer requires a logo before adding to cart", async ({ page }) => {
    test.skip(!apiUp, "API not reachable");
    await page.goto("/personnaliser/tasse-ceramique-11oz");
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByText("Téléversez votre logo pour continuer.")).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("0");
  });

  test("product search filters the catalog", async ({ page }) => {
    test.skip(!apiUp, "API not reachable");
    await page.goto("/produits?q=casquette");
    await expect(page.getByRole("link", { name: "Casquette brodée" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Banderole PVC extérieure" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Tasse céramique 11 oz" })).toHaveCount(0);
  });

  test("customize a mug → cart → checkout → confirmation (real API)", async ({ page }) => {
    test.skip(!apiUp, "API not reachable");
    await customizeMug(page);
    await expect(page.getByTestId("line-estimate")).toHaveText(/15\s?600 HTG/);
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await page.goto("/panier");
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await expect(page.getByTestId("cart-line").getByText("test-logo.png")).toBeVisible();
    await page.getByRole("link", { name: "Passer la commande" }).click();

    await page.getByRole("button", { name: "Confirmer la commande" }).click();
    await expect(page.getByText("Indiquez votre nom complet.")).toBeVisible();

    await page.locator("#fullName").fill("Marie Joseph");
    await page.locator("#phone").fill("+509 3712-3456");
    await page.locator("#email").fill("e2e@example.com");
    await page.getByRole("radio", { name: /Livraison/ }).click();
    await page.getByRole("button", { name: "Confirmer la commande" }).click();
    await expect(page.getByText("Indiquez l'adresse de livraison.")).toBeVisible();
    await page.locator("#city").fill("Port-au-Prince");
    await page.locator("#address").fill("12 rue Capois");
    await page.getByRole("button", { name: "Confirmer la commande" }).click();

    await page.waitForURL(/\/commande\/confirmation\?ref=IP-\d{4}-\d{6}/, { timeout: 15_000 });
    await expect(page.getByTestId("order-ref")).toHaveText(/^IP-\d{4}-\d{6}$/);
    await expect(page.getByTestId("order-subtotal")).toHaveText(/15\s?600 HTG/);
    await expect(page.getByTestId("cart-count")).toHaveText("0");

    // Tracking page finds the same order
    const ref = (await page.getByTestId("order-ref").textContent())!.trim();
    await page.goto(`/suivi?ref=${ref}&email=e2e@example.com`);
    await expect(page.getByTestId("order-ref")).toHaveText(ref);
    await page.goto(`/suivi?ref=${ref}&email=autre@example.com`);
    await expect(page.getByText("Aucune commande trouvée")).toBeVisible();
  });

  test("maps API errors to French messages (mocked 422)", async ({ page }) => {
    test.skip(!apiUp, "API not reachable");
    await customizeMug(page, "12");
    await page.getByRole("button", { name: "Commander maintenant" }).click();
    await page.waitForURL(/\/commande$/);
    // Test-only: force the order endpoint to answer UPLOAD_NOT_FOUND.
    await page.route(`${API}/api/v1/custom-orders`, (route) =>
      route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UPLOAD_NOT_FOUND", message: "Upload not found" } }),
      }),
    );
    await page.locator("#fullName").fill("Marie Joseph");
    await page.locator("#phone").fill("+509 3712-3456");
    await page.locator("#email").fill("e2e@example.com");
    await page.getByRole("button", { name: "Confirmer la commande" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Merci de le téléverser à nouveau" })).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
  });
});
