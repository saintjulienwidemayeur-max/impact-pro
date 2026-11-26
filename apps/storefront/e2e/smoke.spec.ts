import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end tests of the storefront (home, quote, studio, cart, checkout, tracking).
 *
 * Default: they run against `e2e/mock-api.mjs`, a contract-faithful test double of docs/customizer-v2-contract.md
 * (see playwright.config.ts). With `E2E_REAL_API=1` the same flows run against the real API and the mock-only
 * assertions (exact request payloads, mock catalog) are skipped.
 */
const REAL = Boolean(process.env.E2E_REAL_API);
const API = (REAL ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000" : `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`).replace(/\/$/, "");
const fx = (f: string) => path.join(__dirname, "fixtures", f);
const LOGO = fx("test-logo.png");
const LOGO_WHITE_BG = fx("logo-white-bg.png");
const BANNER_ART = fx("banner-art.png");
const PDF = fx("artwork.pdf");

let apiUp = false;
test.beforeAll(async ({ request }) => {
  try {
    apiUp = (await request.get(`${API}/api/v1/health`, { timeout: 5000 })).ok();
  } catch {
    apiUp = false;
  }
});

/** Picks a logo image, accepts the background dialog as-is and waits until the element is in the zone. */
async function addLogo(page: Page, file = LOGO, opts: { keepDialog?: boolean } = {}) {
  const before = await page.getByTestId("layer-item").count();
  await page.getByTestId("logo-input").setInputFiles(file);
  await expect(page.getByTestId("bg-dialog")).toBeVisible();
  if (opts.keepDialog) return;
  await page.getByTestId("bg-confirm").click();
  await expect(page.getByTestId("layer-item")).toHaveCount(before + 1, { timeout: 15_000 });
}

/** Downloads an uploaded file through the page (CORS-enabled fetch) and reports its size and the alpha of its top-left pixel. */
async function inspectUploaded(page: Page, url: string) {
  return page.evaluate(async (u) => {
    const bmp = await createImageBitmap(await (await fetch(u)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    return { w: bmp.width, h: bmp.height, cornerAlpha: ctx.getImageData(0, 0, 1, 1).data[3] };
  }, url);
}

async function fillCheckout(page: Page, email = "e2e@example.com") {
  await page.locator("#fullName").fill("Marie Joseph");
  await page.locator("#phone").fill("+509 3712-3456");
  await page.locator("#email").fill(email);
  await page.getByRole("radio", { name: /Livraison/ }).click();
  await page.locator("#city").fill("Port-au-Prince");
  await page.locator("#address").fill("12 rue Capois");
}

async function lastOrderPayload(page: Page) {
  const res = await page.request.get(`${API}/api/v1/__test/last-order`);
  return (await res.json()).data;
}

test.describe("storefront", () => {
  test("homepage renders key sections with real photos", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Impact Pro/);
    await expect(page.getByRole("img", { name: "Impact Pro" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/sur tout/i);
    await expect(page.getByRole("heading", { name: "Produits populaires" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Personnalisez tout" })).toBeVisible();
    await expect(page.locator('section[aria-labelledby="everything-title"]').getByRole("link", { name: /Ballons de fête/ })).toHaveAttribute("href", "/personnaliser/ballon-personnalise");
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

  test("product search filters the catalog", async ({ page }) => {
    test.skip(!apiUp, "API not reachable");
    await page.goto("/produits?q=polo");
    await expect(page.getByRole("link", { name: /Polo brodé/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Tasse céramique 11 oz" })).toHaveCount(0);
  });
});

test.describe("studio", () => {
  test.beforeEach(() => test.skip(!apiUp, "API not reachable"));

  test("rejects unsupported files and requires a design before adding to cart", async ({ page }) => {
    await page.goto("/personnaliser/tasse-ceramique-11oz");
    await page.getByTestId("logo-input").setInputFiles({ name: "logo.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
    await expect(page.getByText("Format accepté : PNG, JPG, WEBP ou PDF.")).toBeVisible();
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByText("Ajoutez un logo, un texte ou votre fichier pour continuer.")).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("0");
  });

  test("text tool: content, 6-line limit, fonts, colors with hex validation, live canvas", async ({ page }) => {
    await page.goto("/personnaliser/tasse-ceramique-11oz");
    await page.getByTestId("add-text").click();
    await expect(page.getByTestId("element-editor")).toBeVisible();
    const input = page.getByTestId("text-input");
    await input.fill("Bonne fête\nMaman");
    await expect(page.getByTestId("layer-item")).toContainText("Bonne fête");
    await expect(page.getByTestId("design-canvas")).toHaveCSS("opacity", "1", { timeout: 10_000 });

    await input.fill(["1", "2", "3", "4", "5", "6", "7", "8"].join("\n"));
    expect((await input.inputValue()).split("\n")).toHaveLength(6);

    await page.getByTestId("font-bebas-neue").click();
    await expect(page.getByTestId("font-bebas-neue")).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("color-hex").fill("#12");
    await expect(page.getByText("Format attendu : #RRGGBB")).toBeVisible();
    await page.getByTestId("color-hex").fill("#c62828");
    await expect(page.getByText("Format attendu : #RRGGBB")).toHaveCount(0);

    await input.fill("   ");
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByText("Un de vos textes est vide")).toBeVisible();
  });

  test("background removal dialog: default on, tolerance/global modes, pipette, undo, upload of the result", async ({ page }) => {
    await page.goto("/personnaliser/tasse-ceramique-11oz");
    await addLogo(page, LOGO_WHITE_BG, { keepDialog: true });
    const sw = page.getByTestId("bg-switch");
    await expect(sw).toBeChecked(); // opaque, uniform white border → on by default
    // -1 while the preview canvas has not been drawn yet (0×0 canvas), so expect.poll simply retries
    const alphaAt = (x: number, y: number) =>
      page.getByTestId("bg-preview").evaluate((c: HTMLCanvasElement, [px, py]) => (c.width < 2 ? -1 : c.getContext("2d")!.getImageData(px, py, 1, 1).data[3]), [x, y]);
    await expect.poll(() => alphaAt(2, 2)).toBe(0); // corner background removed
    await expect.poll(() => alphaAt(85, 85)).toBe(255); // enclosed white hole of the disc is kept (edge mode)
    await expect.poll(() => alphaAt(60, 60)).toBe(255); // red ring kept

    await page.getByText("Supprimer cette couleur partout").click(); // global mode
    await expect.poll(() => alphaAt(85, 85)).toBe(0);
    await page.getByRole("button", { name: "Annuler", exact: true }).first().click(); // undo
    await expect.poll(() => alphaAt(85, 85)).toBe(255);

    await sw.uncheck();
    await expect.poll(() => alphaAt(2, 2)).toBe(255); // original pixels when the switch is off
    await sw.check();

    await page.getByTestId("bg-pipette").click();
    await page.getByTestId("bg-preview").click({ position: { x: 5, y: 5 } });
    await expect(page.getByText(/Couleur retirée #ffffff/i)).toBeVisible();

    await page.getByTestId("bg-confirm").click();
    await expect(page.getByTestId("layer-item")).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByTestId("layer-item")).toContainText("logo-white-bg.png");
    const thumb = page.getByTestId("layer-item").locator("img");
    await expect(thumb).toBeVisible();
    // what reached the server is a transparent PNG, trimmed to the logo (the original is 240 × 180 on white)
    const up = await inspectUploaded(page, (await thumb.getAttribute("src"))!);
    expect(up.cornerAlpha).toBe(0);
    expect(up.w).toBeLessThan(240);
    expect(up.h).toBeLessThan(180);
  });

  test("dialog can be cancelled and the original sent as-is when the switch is off", async ({ page }) => {
    await page.goto("/personnaliser/tasse-ceramique-11oz");
    await addLogo(page, LOGO_WHITE_BG, { keepDialog: true });
    await page.getByRole("button", { name: "Fermer" }).click();
    await expect(page.getByTestId("bg-dialog")).toHaveCount(0);
    await expect(page.getByTestId("layer-item")).toHaveCount(0);

    await addLogo(page, LOGO_WHITE_BG, { keepDialog: true });
    await page.getByTestId("bg-switch").uncheck();
    await expect(page.getByTestId("bg-confirm")).toHaveText("Utiliser le logo tel quel");
    await page.getByTestId("bg-confirm").click();
    await expect(page.getByTestId("layer-item")).toHaveCount(1, { timeout: 15_000 });
    const up = await inspectUploaded(page, (await page.getByTestId("layer-item").locator("img").getAttribute("src"))!);
    expect(up).toMatchObject({ w: 240, h: 180, cornerAlpha: 255 }); // the untouched original
  });

  test("PDF logos skip the background dialog", async ({ page }) => {
    await page.goto("/personnaliser/tasse-ceramique-11oz");
    await page.getByTestId("logo-input").setInputFiles(PDF);
    await expect(page.getByTestId("layer-item")).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByTestId("bg-dialog")).toHaveCount(0);
  });

  test("move, resize and layer controls act on the selected element", async ({ page }) => {
    await page.goto("/personnaliser/tasse-ceramique-11oz");
    await page.getByTestId("add-text").click();
    await page.getByTestId("text-input").fill("Déplace-moi");
    const el = page.getByTestId("design-el-text");
    await expect(el).toBeVisible();
    const b0 = (await el.boundingBox())!;
    await el.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    const b1 = (await el.boundingBox())!;
    expect(b1.x).toBeGreaterThan(b0.x + 3);
    expect(b1.y).toBeGreaterThan(b0.y);

    await page.keyboard.press("+");
    const b2 = (await el.boundingBox())!;
    expect(b2.width).toBeGreaterThan(b1.width);

    // drag with the pointer (make sure the element is inside the viewport: mouse events outside it are ignored)
    await el.scrollIntoViewIfNeeded();
    const b3 = (await el.boundingBox())!;
    await page.mouse.move(b3.x + b3.width / 2, b3.y + b3.height / 2);
    await page.mouse.down();
    await page.mouse.move(b3.x + b3.width / 2 - 40, b3.y + b3.height / 2 - 12, { steps: 6 });
    await page.mouse.up();
    const b4 = (await el.boundingBox())!;
    expect(b4.x).toBeLessThan(b3.x - 10);

    // sliders + duplicate + delete
    await page.locator("#el-rotation").fill("30");
    await expect(page.locator("#el-rotation")).toHaveValue("30");
    await page.getByRole("button", { name: /^Dupliquer/ }).first().click();
    await expect(page.getByTestId("layer-item")).toHaveCount(2);
    await page.getByTestId("element-delete").click();
    await expect(page.getByTestId("layer-item")).toHaveCount(1);
  });

  test("multi-zone order: logo on the front + text on the back → cart v3 → checkout → confirmation", async ({ page }) => {
    await page.goto("/personnaliser/polo-brode");
    await expect(page.getByTestId("zone-tabs")).toBeVisible();

    await page.getByTestId("zone-FRONT").click();
    await addLogo(page, LOGO);

    await page.getByTestId("zone-BACK").click();
    await expect(page.getByTestId("layer-item")).toHaveCount(0); // zones are independent
    await page.getByTestId("add-text").click();
    await page.getByTestId("text-input").fill("Équipe Haïti 2026");
    await page.getByTestId("font-bebas-neue").click();
    await page.getByTestId("color-hex").fill("#0A716A");
    await expect(page.getByTestId("zone-FRONT")).toContainText("1"); // badge: element count per zone
    await expect(page.getByTestId("zone-BACK")).toContainText("1");

    await page.locator("#cz-size").selectOption("M");
    await page.locator("#cz-quantity").fill("10");
    await expect(page.getByTestId("line-estimate")).toHaveText(/14\s?500 HTG/);
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    // cart v3 storage shape (v2 key is gone)
    const stored = await page.evaluate(() => ({ v3: JSON.parse(localStorage.getItem("impactpro.cart.v3") ?? "[]"), v2: localStorage.getItem("impactpro.cart.v2") }));
    expect(stored.v2).toBeNull();
    expect(stored.v3[0].elements.map((e: { placement: string; kind: string }) => `${e.placement}:${e.kind}`)).toEqual(["FRONT:LOGO", "BACK:TEXT"]);

    await page.goto("/panier");
    const line = page.getByTestId("cart-line");
    await expect(line).toHaveCount(1);
    await expect(line).toContainText("Devant");
    await expect(line).toContainText("1 logo");
    await expect(line).toContainText("Dos");
    await expect(line).toContainText("Équipe Haïti 2026");
    await page.getByRole("link", { name: "Passer la commande" }).click();

    await page.getByRole("button", { name: "Confirmer la commande" }).click();
    await expect(page.getByText("Indiquez votre nom complet.")).toBeVisible();
    await fillCheckout(page);
    await page.getByRole("button", { name: "Confirmer la commande" }).click();

    await page.waitForURL(/\/commande\/confirmation\?ref=IP-\d{4}-\d{6}/, { timeout: 15_000 });
    await expect(page.getByTestId("order-ref")).toHaveText(/^IP-\d{4}-\d{6}$/);
    await expect(page.getByTestId("order-subtotal")).toHaveText(/14\s?500 HTG/);
    await expect(page.getByTestId("cart-count")).toHaveText("0");
    const design = page.getByTestId("order-design");
    await expect(design).toContainText("Devant");
    await expect(design).toContainText("Dos");
    await expect(design).toContainText("Équipe Haïti 2026");
    await expect(design).toContainText("Bebas Neue");

    if (!REAL) {
      const payload = await lastOrderPayload(page);
      const item = payload.items[0];
      expect(item).toMatchObject({ productSlug: "polo-brode", quantity: 10, size: "M" });
      expect(item.elements).toHaveLength(2);
      expect(item.elements[0]).toMatchObject({ placement: "FRONT", kind: "LOGO", sort: 0, x: 0, y: 0, rotation: 0 });
      expect(item.elements[0].uploadId).toMatch(/^[0-9a-f-]{36}$/);
      expect(item.elements[1]).toMatchObject({ placement: "BACK", kind: "TEXT", text: "Équipe Haïti 2026", font: "bebas-neue", color: "#0A716A", sort: 1 });
      expect(item.logoUploadId).toBeUndefined(); // legacy fields are not sent
      expect(item.placement).toBeUndefined();
    }

    // tracking
    const ref = (await page.getByTestId("order-ref").textContent())!.trim();
    await page.goto(`/suivi?ref=${ref}&email=e2e@example.com`);
    await expect(page.getByTestId("order-ref")).toHaveText(ref);
    await expect(page.getByTestId("order-design")).toContainText("Équipe Haïti 2026");
    await page.goto(`/suivi?ref=${ref}&email=autre@example.com`);
    await expect(page.getByText("Aucune commande trouvée")).toBeVisible();
  });

  test("zones without a dedicated photo show an indicative note", async ({ page }) => {
    test.skip(REAL, "relies on the mock catalog colors");
    await page.goto("/personnaliser/polo-brode");
    await page.getByRole("radio", { name: "Blanc" }).click();
    await page.getByTestId("zone-BACK").click();
    await expect(page.getByTestId("indicative-note")).toContainText("Aperçu indicatif de l'emplacement : Dos");
    await page.getByTestId("add-text").click();
    await expect(page.getByText("Aperçu indicatif de l'emplacement : Dos").first()).toBeVisible();
    await expect(page.getByTestId("design-canvas")).toHaveCSS("opacity", "1", { timeout: 10_000 });
  });

  test("banner: artwork required, custom size, area pricing, fit/fill", async ({ page }) => {
    // banderole-pvc: PER_AREA at 2 800 HTG/m², customSize 50–1000 × 50–500 cm, minimum billable 1 m² (same in seed and mock)
    await page.goto("/personnaliser/banderole-pvc");
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByText("Importez votre fichier prêt à imprimer pour continuer.")).toBeVisible();

    await page.getByTestId("artwork-input").setInputFiles(BANNER_ART);
    await expect(page.getByTestId("layer-item")).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByTestId("layer-item")).toContainText("banner-art.png");
    await expect(page.getByTestId("design-canvas")).toHaveCSS("opacity", "1", { timeout: 10_000 });
    await expect(page.getByTestId("bg-dialog")).toHaveCount(0); // no background removal for artwork

    // default 300 × 120 cm = 3.6 m² at 2 800 HTG/m²
    await expect(page.getByTestId("custom-size")).toContainText("3.60 m²");
    await expect(page.getByTestId("line-estimate")).toHaveText(/10\s?080 HTG/);
    await page.locator("#cz-width").fill("200");
    await page.locator("#cz-height").fill("100");
    await expect(page.getByTestId("line-estimate")).toHaveText(/5\s?600 HTG/);
    await page.locator("#cz-width").fill("60");
    await page.locator("#cz-height").fill("60"); // 0.36 m² → minimum billable 1 m²
    await expect(page.getByTestId("line-estimate")).toHaveText(/2\s?800 HTG/);
    await page.locator("#cz-width").fill("20");
    await expect(page.getByTestId("line-estimate")).toHaveText("—");
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByText(/Largeur 50–1000 cm/)).toBeVisible();
    await expect(page.locator("#cz-size")).toHaveCount(0); // sizes are quick-pick dimensions, not a separate select

    await page.getByRole("button", { name: /300 × 120 cm/ }).click();
    await page.getByTestId("artwork-cover").click();
    await page.getByTestId("artwork-contain").click();
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await page.goto("/panier");
    await expect(page.getByTestId("cart-line")).toContainText("300 × 120 cm");
    await expect(page.getByTestId("cart-total")).toHaveText(/10\s?080 HTG/);
    await page.getByRole("link", { name: "Passer la commande" }).click();
    await fillCheckout(page);
    await page.getByRole("button", { name: "Confirmer la commande" }).click();
    await page.waitForURL(/\/commande\/confirmation/, { timeout: 15_000 });
    await expect(page.getByTestId("order-subtotal")).toHaveText(/10\s?080 HTG/);
    await expect(page.getByTestId("order-design")).toContainText("Fichier prêt à imprimer");

    if (!REAL) {
      const item = (await lastOrderPayload(page)).items[0];
      expect(item).toMatchObject({ productSlug: "banderole-pvc", widthCm: 300, heightCm: 120, quantity: 1 });
      expect(item.elements[0]).toMatchObject({ placement: "FULL", kind: "ARTWORK", scale: 1 });
    }
  });

  test("products without photography use a plain print-area frame; PDF artwork is accepted", async ({ page }) => {
    test.skip(REAL, "relies on the mock catalog (autocollants has no photography)");
    await page.goto("/personnaliser/autocollants");
    await expect(page.getByText(/Photo du produit à venir/)).toBeVisible();
    await page.getByTestId("artwork-input").setInputFiles(PDF);
    await expect(page.getByTestId("layer-item")).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByTestId("design-canvas")).toBeVisible();
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
  });

  test("maps API errors to French messages (mocked 422 responses)", async ({ page }) => {
    await page.goto("/personnaliser/tasse-ceramique-11oz");
    await page.getByTestId("add-text").click();
    await page.getByTestId("text-input").fill("Test");
    await page.locator("#cz-quantity").fill("12");
    await page.getByRole("button", { name: "Commander maintenant" }).click();
    await page.waitForURL(/\/commande$/);
    await fillCheckout(page);

    // Test-only: force the order endpoint to answer with each documented error code.
    const cases: [string, string][] = [
      ["UPLOAD_NOT_FOUND", "Merci de le téléverser à nouveau"],
      ["ARTWORK_REQUIRED", "nécessite votre fichier prêt à imprimer"],
      ["SIZE_OUT_OF_RANGE", "hors des limites"],
      ["ELEMENT_NOT_SUPPORTED", "n'est pas disponible pour ce produit"],
    ];
    for (const [code, text] of cases) {
      await page.route(`${API}/api/v1/custom-orders`, (route) =>
        route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: { code, message: code } }) }),
      );
      await page.getByRole("button", { name: "Confirmer la commande" }).click();
      await expect(page.getByRole("alert").filter({ hasText: text }).first()).toBeVisible();
      await page.unroute(`${API}/api/v1/custom-orders`);
    }
    await page.route(`${API}/api/v1/custom-orders`, (route) =>
      route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "VALIDATION_ERROR", message: "Validation failed", details: [{ field: "items.0.elements.0.text", messages: ["text must be 1..200 characters"] }] } }),
      }),
    );
    await page.getByRole("button", { name: "Confirmer la commande" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "text must be 1..200 characters" }).first()).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
  });
});

test.describe("parameters per product, final preview, order mock-ups", () => {
  test.beforeEach(() => test.skip(!apiUp, "API not reachable"));

  const minQty = async (page: Page) => (await page.locator("#cz-quantity").getAttribute("min")) ?? "1";

  test("football: no color or size is asked, only the design and the quantity", async ({ page }) => {
    await page.goto("/personnaliser/ballon-football");
    await expect(page.getByRole("heading", { name: "Votre design" })).toBeVisible();
    await expect(page.getByTestId("options")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Options/ })).toHaveCount(0);
    await expect(page.locator("#cz-size")).toHaveCount(0);
    await expect(page.getByRole("radiogroup")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Quantité/ })).toContainText("2"); // steps are renumbered: design, quantity

    await page.getByTestId("add-text").click();
    await page.getByTestId("text-input").fill("Champions 2026");
    await page.locator("#cz-quantity").fill(await minQty(page));
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await page.goto("/panier");
    await expect(page.getByTestId("cart-line")).not.toContainText("Taille");
    await expect(page.getByTestId("cart-line")).not.toContainText("Couleur");
    await page.getByRole("link", { name: "Passer la commande" }).click();
    await fillCheckout(page);
    await page.getByRole("button", { name: "Confirmer la commande" }).click();
    await page.waitForURL(/\/commande\/confirmation/, { timeout: 30_000 });
    if (!REAL) {
      const item = (await lastOrderPayload(page)).items[0];
      expect(item.productSlug).toBe("ballon-football");
      expect(item.size).toBeUndefined();
      expect(item.color).toBeUndefined();
    }
  });

  test("t-shirt: color and size are asked (size required), shown with their labels in the cart", async ({ page }) => {
    await page.goto("/personnaliser/t-shirt-personnalise");
    await expect(page.getByTestId("option-color")).toContainText("Couleur");
    await expect(page.getByTestId("option-size")).toContainText("Taille");
    await page.getByTestId("zone-FRONT").click();
    await addLogo(page);
    await page.locator("#cz-quantity").fill(await minQty(page));
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByText("Veuillez choisir : taille.")).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("0");
    await page.locator("#cz-size").selectOption("L");
    await page.getByRole("radio", { name: "Noir" }).click();
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await page.goto("/panier");
    await expect(page.getByTestId("cart-line")).toContainText("Couleur : Noir");
    await expect(page.getByTestId("cart-line")).toContainText("Taille : L");
  });

  test("phone case: the size field is the phone model", async ({ page }) => {
    await page.goto("/personnaliser/coque-telephone");
    await expect(page.locator('label[for="cz-size"]')).toContainText("Modèle du téléphone");
    await page.getByTestId("add-text").click();
    await page.getByTestId("text-input").fill("Mon style");
    await page.locator("#cz-quantity").fill(await minQty(page));
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByText("Veuillez choisir : modèle du téléphone.")).toBeVisible();
    const models = await page.locator("#cz-size option").allTextContents();
    expect(models.length).toBeGreaterThan(2);
    await page.locator("#cz-size").selectOption({ index: 2 });
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await page.goto("/panier");
    await expect(page.getByTestId("cart-line")).toContainText(`Modèle du téléphone : ${models[2]}`);
  });

  test("tent: only the dimensions are asked (no colour choice: the photo shows one colour)", async ({ page }) => {
    await page.goto("/personnaliser/tente-pliante-3x3");
    await expect(page.getByTestId("option-size")).toContainText("Dimensions");
    await expect(page.getByTestId("option-color")).toHaveCount(0);
    await expect(page.getByTestId("zone-tabs")).toBeVisible();
  });

  test("final preview, cart mock-ups and the mock-ups stored with the order", async ({ page }) => {
    await page.goto("/personnaliser/polo-brode");
    await page.getByTestId("zone-FRONT").click();
    await addLogo(page);
    await page.getByTestId("zone-BACK").click();
    await page.getByTestId("add-text").click();
    await page.getByTestId("text-input").fill("Équipe Haïti 2026");
    await page.locator("#cz-size").selectOption("M");
    await page.locator("#cz-quantity").fill(await minQty(page));

    // « Voir le rendu final »: every zone, no handles, download + back to editing
    await page.getByTestId("final-open").click();
    const dialog = page.getByTestId("final-preview");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("final-zone")).toHaveCount(2);
    await expect(dialog.locator('[data-testid="handle-scale"]')).toHaveCount(0);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("final-download").click()]);
    expect(download.suggestedFilename()).toBe("apercu-polo-brode.png");
    expect(fs.statSync((await download.path())!).size).toBeGreaterThan(5_000);
    await page.getByTestId("final-back").click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await page.goto("/panier");
    await expect(page.getByTestId("cart-mockup")).toHaveCount(2); // one rendered thumbnail per zone
    await page.getByTestId("cart-final-open").click();
    await expect(page.getByTestId("final-zone")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("final-preview")).toHaveCount(0);

    await page.getByRole("link", { name: "Passer la commande" }).click();
    await expect(page.getByTestId("cart-mockup")).toHaveCount(2); // checkout summary too
    await fillCheckout(page);
    await page.getByRole("button", { name: "Confirmer la commande" }).click();
    await page.waitForURL(/\/commande\/confirmation/, { timeout: 40_000 });
    await expect(page.getByTestId("order-mockup")).toHaveCount(2);
    await expect(page.getByTestId("order-options")).toContainText("Taille : M");
    if (!REAL) {
      const item = (await lastOrderPayload(page)).items[0];
      expect(item.previews.map((p: { placement: string }) => p.placement).sort()).toEqual(["BACK", "FRONT"]);
      await expect(page.getByTestId("order-mockup").first()).toHaveAttribute("data-source", "server");
    }
    const ref = (await page.getByTestId("order-ref").textContent())!.trim();
    await page.goto(`/suivi?ref=${ref}&email=e2e@example.com`);
    await expect(page.getByTestId("order-mockup")).toHaveCount(2);
  });

  test("the order still succeeds when mock-ups cannot be uploaded", async ({ page }) => {
    await page.route(`${API}/api/v1/uploads/previews`, (route) => route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "NOT_FOUND", message: "x" } }) }));
    await page.goto("/personnaliser/tasse-ceramique-11oz");
    await page.getByTestId("add-text").click();
    await page.getByTestId("text-input").fill("Sans aperçu");
    await page.locator("#cz-quantity").fill(await minQty(page));
    await page.getByRole("button", { name: "Commander maintenant" }).click();
    await page.waitForURL(/\/commande$/);
    await fillCheckout(page);
    await page.getByRole("button", { name: "Confirmer la commande" }).click();
    await page.waitForURL(/\/commande\/confirmation/, { timeout: 40_000 });
    await expect(page.getByTestId("order-ref")).toHaveText(/^IP-/);
    await expect(page.getByTestId("order-mockup")).toHaveCount(1);
    await expect(page.getByTestId("order-mockup")).toHaveAttribute("data-source", "client"); // rendered from the stored design
  });

  test("new texts are fitted to the print area until resized by hand", async ({ page }) => {
    await page.goto("/personnaliser/t-shirt-personnalise");
    await page.getByTestId("zone-BACK").click();
    await page.getByTestId("add-text").click();
    await page.getByTestId("text-input").fill("ÉQUIPE HAÏTI CHAMPIONS 2026");
    const el = page.getByTestId("design-el-text");
    const overlay = page.getByTestId("design-overlay");
    await expect(el).toBeVisible();
    await expect.poll(async () => (await el.boundingBox())!.width <= (await overlay.boundingBox())!.width + 1).toBe(true);
    // growing it by hand switches the automatic fitting off
    await el.focus();
    for (let i = 0; i < 8; i++) await page.keyboard.press("+");
    const grown = (await el.boundingBox())!.width;
    await page.getByTestId("text-input").fill("ÉQUIPE HAÏTI CHAMPIONS 2026 !");
    expect(Math.abs((await el.boundingBox())!.width - grown)).toBeGreaterThan(0); // not re-fitted: it follows the text, not the area
    await expect.poll(async () => (await el.boundingBox())!.width > (await overlay.boundingBox())!.width).toBe(true);
  });
});
