// End-to-end against the REAL API (scratch database). Serial: each step builds on the previous one.
import { expect, test, type Page } from "@playwright/test";

const API = `http://localhost:${process.env.E2E_API_PORT ?? 4410}/api/v1`;
const OWNER = "owner@impactpro.test";
const BOOT_PW = process.env.E2E_BOOTSTRAP_PASSWORD!;
const OWNER_PW = `${BOOT_PW}Qm4!`;
const SALES = "vente@impactpro.test";

test.describe.configure({ mode: "serial" });

let salesTemp = "";
const SALES_PW = `${BOOT_PW}Sv7!`;

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
async function signOut(page: Page) {
  await page.getByTestId("user-menu").click();
  await page.getByTestId("logout").click();
  await expect(page).toHaveURL(/\/login/);
}
async function forcedChange(page: Page, current: string, next: string) {
  await expect(page).toHaveURL(/changer-mot-de-passe/);
  await page.locator("#cp-current").fill(current);
  await page.locator("#cp-new").fill(next);
  await page.locator("#cp-confirm").fill(next);
  await page.getByRole("button", { name: /enregistrer/i }).click();
  await expect(page.getByTestId("dashboard")).toBeVisible();
}

test("bootstrap admin: login → forced password change → dashboard", async ({ page }) => {
  await signIn(page, OWNER, BOOT_PW);
  await forcedChange(page, BOOT_PW, OWNER_PW);
  await expect(page.getByTestId("user-role")).toContainText(/super/i);
});

test("a public order appears in the orders list and detail", async ({ page }) => {
  const cat = await (await fetch(`${API}/catalog/products`)).json();
  const slug = cat.data[0].slug as string;
  const res = await fetch(`${API}/custom-orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      customer: { fullName: "Jean Baptiste", company: "Boutique Soleil", phone: "+509 3700 0001", email: "jean@example.com" },
      items: [{ productSlug: slug, quantity: 60, elements: [{ placement: "FRONT", kind: "TEXT", text: "Soleil" }] }],
      deliveryMethod: "PICKUP",
    }),
  });
  expect(res.status).toBe(201);
  const reference = (await res.json()).data.reference as string;

  await signIn(page, OWNER, OWNER_PW);
  await page.goto("/commandes");
  await expect(page.getByTestId("orders-rows")).toContainText(reference);
  await page.getByTestId("orders-search").fill("Soleil");
  await expect(page.getByTestId("orders-rows").getByRole("row")).toHaveCount(1);
  await page.getByRole("link", { name: reference }).click();
  await expect(page.getByTestId("order-item")).toHaveCount(1);
  await expect(page.getByTestId("order-subtotal")).toContainText("34");

  // status change (real transition rules)
  await page.getByTestId("to-MOCKUP_SENT").click();
  await page.getByTestId("confirm-ok").click();
  await expect(page.getByTestId("timeline")).toContainText(/maquette/i);
  await page.getByTestId("note-input").fill("Client prévenu par WhatsApp.");
  await page.getByTestId("note-add").click();
  await expect(page.getByTestId("timeline")).toContainText("WhatsApp");
});

test("quote → proforma → invoice → mark sent → partial then full payment → PDF", async ({ page }) => {
  await signIn(page, OWNER, OWNER_PW);
  await page.goto("/commandes");
  await page.getByTestId("orders-rows").getByRole("link").first().click();
  await page.getByTestId("create-quote").click();
  await page.getByTestId("create-from-order").click();
  await expect(page.getByTestId("line-row")).toHaveCount(1);
  await page.getByTestId("doc-tax").fill("10");
  await page.getByTestId("doc-save").click();
  await expect(page.getByTestId("doc-status")).toContainText(/brouillon/i);
  await expect(page.getByTestId("doc-total")).toContainText("37");

  // e-mail is not configured on the real API yet → clear message, then « marquer comme envoyé seulement »
  await page.getByTestId("doc-send").click();
  await page.getByTestId("send-confirm").click();
  await expect(page.getByTestId("mail-not-configured")).toBeVisible();
  await page.getByTestId("mark-sent").click();
  await expect(page.getByTestId("doc-status")).toContainText(/envoy/i);

  await page.getByTestId("doc-convert").click();
  await page.getByTestId("confirm-ok").click();
  await expect(page.getByRole("heading", { name: /^PRO-/ })).toBeVisible();
  await page.getByTestId("doc-send").click();
  await page.getByTestId("mark-sent").click();
  await expect(page.getByTestId("doc-status")).toContainText(/envoy/i);
  await page.getByTestId("doc-convert").click();
  await page.getByTestId("confirm-ok").click();
  await expect(page.getByRole("heading", { name: /^FAC-/ })).toBeVisible();
  await page.getByTestId("doc-send").click();
  await page.getByTestId("mark-sent").click();

  await page.getByTestId("doc-pay").click();
  await page.getByTestId("payment-amount").fill("10000");
  await page.getByTestId("payment-save").click();
  await expect(page.getByTestId("doc-status")).toContainText(/en partie/i);
  await expect(page.getByTestId("doc-balance")).toContainText("27");

  await page.getByTestId("doc-pay").click();
  await page.getByTestId("payment-amount").fill("99999999");
  await page.getByTestId("payment-save").click();
  await expect(page.getByRole("alert").filter({ hasText: /dépasse/ })).toBeVisible();
  await page.getByTestId("payment-amount").fill("27950");
  await page.getByTestId("payment-save").click();
  await expect(page.getByTestId("doc-status")).toContainText(/^Payé$/);
  await expect(page.getByTestId("payments").getByRole("listitem")).toHaveCount(2);

  const src = (await page.getByTestId("pdf-frame").getAttribute("src"))!.split("#")[0];
  const res = await page.request.get(src);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");
  const body = await res.body();
  expect(body.subarray(0, 4).toString()).toBe("%PDF");

  // customer page now shows the document and its balance (customer link comes from the order)
  await page.getByRole("link", { name: "Jean Baptiste" }).first().click();
  await expect(page.getByTestId("balances")).toBeVisible();
});

test("reports and dashboard reflect the billing", async ({ page }) => {
  await signIn(page, OWNER, OWNER_PW);
  await page.goto("/rapports");
  await expect(page.getByTestId("revenue-HTG")).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("dashboard")).toContainText("HTG");
});

test("create a SALES user: temporary password, role-limited nav, 403 on invoice write", async ({ page }) => {
  await signIn(page, OWNER, OWNER_PW);
  await page.goto("/utilisateurs");
  await page.getByTestId("user-new").click();
  await page.getByTestId("user-name").fill("Vente Test");
  await page.getByTestId("user-email").fill(SALES);
  await page.getByTestId("user-role-new").selectOption("SALES");
  await page.getByTestId("user-create").click();
  salesTemp = ((await page.getByTestId("temp-password").textContent()) ?? "").trim();
  expect(salesTemp.length).toBeGreaterThanOrEqual(12);
  await page.getByTestId("temp-close").click();
  await expect(page.getByTestId("users-rows")).toContainText(SALES);
  await signOut(page);

  await signIn(page, SALES, salesTemp);
  await forcedChange(page, salesTemp, SALES_PW);
  const nav = page.getByTestId("sidebar-nav");
  await expect(nav.getByRole("link", { name: "Commandes", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Devis", exact: true })).toBeVisible();
  for (const hidden of ["Utilisateurs & rôles", "Paramètres", "Journal d'audit"]) await expect(nav.getByRole("link", { name: hidden, exact: true })).toHaveCount(0);

  // server is the authority: a direct invoice write is refused
  const status = await page.evaluate(async () => {
    const csrf = document.cookie.split("; ").find((c) => c.startsWith("ip_csrf="))?.split("=")[1] ?? "";
    const r = await fetch("/api/v1/admin/documents", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": decodeURIComponent(csrf) }, body: JSON.stringify({ type: "INVOICE", customer: { name: "Test Client", email: "x@example.com" }, lines: [{ description: "Test", quantity: 1, unitPrice: "1.00" }] }) });
    return r.status;
  });
  expect(status).toBe(403);
  await page.goto("/utilisateurs");
  await expect(page.getByTestId("forbidden")).toBeVisible();
  await page.goto("/factures");
  await expect(page.getByTestId("doc-new")).toHaveCount(0);
});

test("customers and products can be created / edited", async ({ page }) => {
  await signIn(page, OWNER, OWNER_PW);
  await page.goto("/clients");
  await page.getByTestId("customer-new").click();
  await page.locator("#c-name").fill("Nadège Pierre");
  await page.locator("#c-email").fill("nadege@example.com");
  await page.locator("#c-phone").fill("+509 3700 0099");
  await page.getByTestId("customer-save").click();
  await expect(page.getByTestId("customers-rows")).toContainText("Nadège Pierre");
  await page.getByRole("link", { name: "Nadège Pierre" }).click();
  await page.getByTestId("customer-edit").click();
  await page.locator("#c-company").fill("Pierre & Fils");
  await page.getByTestId("customer-save").click();
  await expect(page.getByText("Pierre & Fils").first()).toBeVisible();

  await page.goto("/produits");
  await page.getByTestId("products-rows").getByRole("link").first().click();
  await page.getByTestId("tier-price").last().fill("111");
  await page.getByTestId("product-save").click();
  await expect(page.getByText("Produit enregistré.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("tier-price").last()).toHaveValue("111.00");
});

test("settings save then audit log shows the actions", async ({ page }) => {
  await signIn(page, OWNER, OWNER_PW);
  await page.goto("/parametres");
  await page.getByTestId("set-taxRate").fill("7");
  await page.getByTestId("set-prefix-quote").fill("DV");
  await page.getByTestId("settings-save").click();
  await expect(page.getByText("Paramètres enregistrés.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("set-prefix-quote")).toHaveValue("DV");

  await page.goto("/audit");
  const rows = page.getByTestId("audit-rows");
  for (const label of ["Paiement enregistré", "Document envoyé", "Paramètres de facturation", "Utilisateur créé", "Statut de commande", "Mot de passe changé"]) await expect(rows).toContainText(label);
});
