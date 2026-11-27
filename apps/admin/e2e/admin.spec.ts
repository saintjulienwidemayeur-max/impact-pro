import { expect, test } from "@playwright/test";
import { login, loginAs, PASSWORD, resetMock, setMail, type Role } from "./helpers";


test.beforeEach(async ({}, info) => {
  test.skip(info.project.name === "mobile", "flows run on desktop; mobile has its own smoke spec");
  await resetMock();
});

test.describe("authentication", () => {
  test("bad password shows an error and stays on /login", async ({ page }) => {
    await login(page, "sales@impactpro.test", "wrong-password-123");
    await expect(page.getByTestId("login-error")).toContainText(/incorrect/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test("a customer account is refused (staff only)", async ({ page }) => {
    await login(page, "client@example.com");
    await expect(page.getByTestId("login-error")).toContainText(/équipe/i);
  });

  test("guest is redirected to /login", async ({ page }) => {
    await page.goto("/commandes");
    await expect(page).toHaveURL(/\/login/);
  });

  test("temporary password forces a change, then lands on the dashboard", async ({ page }) => {
    await login(page, "temp@impactpro.test");
    await expect(page).toHaveURL(/changer-mot-de-passe/);
    await page.locator("#cp-current").fill(PASSWORD);
    await page.locator("#cp-new").fill("Another-Strong-Pass-99");
    await page.locator("#cp-confirm").fill("Another-Strong-Pass-99");
    await page.getByRole("button", { name: /enregistrer/i }).click();
    await expect(page.getByTestId("dashboard")).toBeVisible();
  });

  test("logout returns to /login", async ({ page }) => {
    await loginAs(page, "admin");
    await page.getByTestId("user-menu").click();
    await page.getByTestId("logout").click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("navigation per role", () => {
  const expected: Record<Role, { has: string[]; hasNot: string[] }> = {
    superadmin: { has: ["Utilisateurs & rôles", "Journal d'audit", "Paramètres", "Factures", "Rapports"], hasNot: [] },
    admin: { has: ["Utilisateurs & rôles", "Paramètres", "Messagerie"], hasNot: [] },
    sales: { has: ["Commandes", "Clients", "Devis", "Messagerie"], hasNot: ["Utilisateurs & rôles", "Paramètres", "Journal d'audit"] },
    accounting: { has: ["Factures", "Rapports", "Paramètres"], hasNot: ["Utilisateurs & rôles", "Produits & prix"] },
    production: { has: ["Commandes", "Produits & prix"], hasNot: ["Clients", "Factures", "Devis", "Messagerie", "Rapports", "Paramètres"] },
    support: { has: ["Clients", "Messagerie"], hasNot: ["Factures", "Devis", "Produits & prix", "Utilisateurs & rôles"] },
  };
  for (const [role, e] of Object.entries(expected) as [Role, (typeof expected)[Role]][]) {
    test(`${role}`, async ({ page }) => {
      await loginAs(page, role);
      const nav = page.getByTestId("sidebar-nav");
      for (const label of e.has) await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
      for (const label of e.hasNot) await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
    });
  }

  test("direct URL without permission shows « Accès refusé »", async ({ page }) => {
    await loginAs(page, "production");
    await page.goto("/utilisateurs");
    await expect(page.getByTestId("forbidden")).toBeVisible();
    await page.goto("/factures");
    await expect(page.getByTestId("forbidden")).toBeVisible();
  });
});

test.describe("orders", () => {
  test("list, search and status flow with transitions and notes", async ({ page }) => {
    await loginAs(page, "sales");
    await page.goto("/commandes");
    await expect(page.getByTestId("orders-rows").getByRole("row")).toHaveCount(2);
    await page.getByTestId("orders-search").fill("Marie");
    await expect(page.getByTestId("orders-rows").getByRole("row")).toHaveCount(1);
    await page.getByTestId("orders-search").fill("");
    await page.getByRole("link", { name: "IP-2026-0001" }).click();

    await expect(page.getByTestId("status-stepper")).toBeVisible();
    await expect(page.getByTestId("order-item")).toHaveCount(2);
    await expect(page.getByTestId("to-MOCKUP_SENT")).toBeVisible();
    await expect(page.getByTestId("to-DELIVERED")).toHaveCount(0); // cannot skip steps
    await page.getByTestId("to-MOCKUP_SENT").click();
    await expect(page.getByTestId("status-dialog")).toBeVisible();
    await page.getByTestId("confirm-ok").click();
    await expect(page.getByTestId("timeline")).toContainText("MOCKUP_SENT");

    await page.getByTestId("note-input").fill("Client rappelé, maquette validée oralement.");
    await page.getByTestId("note-add").click();
    await expect(page.getByTestId("timeline")).toContainText("maquette validée oralement");
  });

  test("production role can change status but sees no billing buttons", async ({ page }) => {
    await loginAs(page, "production");
    await page.goto("/commandes");
    await page.getByRole("link", { name: "IP-2026-0002" }).click();
    await expect(page.getByTestId("to-IN_PRODUCTION")).toBeVisible();
    await expect(page.getByTestId("create-quote")).toHaveCount(0);
    await expect(page.getByTestId("create-invoice")).toHaveCount(0);
  });
});

test.describe("billing", () => {
  test("order → quote → proforma → invoice → send (mail off) → payment → PDF", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/commandes");
    await page.getByRole("link", { name: "IP-2026-0001" }).click();
    await page.getByTestId("create-quote").click();
    await expect(page.getByTestId("from-order")).toBeVisible();
    await page.getByTestId("create-from-order").click();

    // editor with prefilled lines (24×450 + 12×650 = 18 600,00)
    await expect(page.getByTestId("line-row")).toHaveCount(2);
    await expect(page.getByTestId("t-total")).toContainText("18");
    await page.getByTestId("doc-tax").fill("10");
    await expect(page.getByTestId("t-tax")).toContainText("1");
    await page.getByTestId("doc-save").click();
    await expect(page.getByTestId("doc-status")).toContainText(/brouillon/i);
    await expect(page.getByTestId("doc-total")).toContainText("20");
    await expect(page.getByTestId("pdf-frame")).toBeVisible();

    // send while the mail module is not configured → clear message, nothing changes
    await page.getByTestId("doc-send").click();
    await page.getByTestId("send-confirm").click();
    await expect(page.getByTestId("mail-not-configured")).toContainText(/messagerie/i);
    await expect(page.getByTestId("doc-status")).toContainText(/brouillon/i);
    // … then « marquer comme envoyé seulement » works
    await page.getByTestId("mark-sent").click();
    await expect(page.getByTestId("doc-status")).toContainText(/envoy/i);

    // convert quote → proforma → invoice
    await page.getByTestId("doc-convert").click();
    await page.getByTestId("confirm-ok").click();
    await expect(page).toHaveURL(/\/documents\/doc_/);
    await expect(page.getByRole("heading", { name: /^PRO-/ })).toBeVisible();
    await page.getByTestId("doc-send").click();
    await page.getByTestId("mark-sent").click();
    await page.getByTestId("doc-convert").click();
    await page.getByTestId("confirm-ok").click();
    await expect(page.getByRole("heading", { name: /^FAC-/ })).toBeVisible();
    await page.getByTestId("doc-send").click();
    await page.getByTestId("mark-sent").click();
    await expect(page.getByTestId("doc-pay")).toBeVisible();

    // partial payment then settle
    await page.getByTestId("doc-pay").click();
    await page.getByTestId("payment-amount").fill("5000");
    await page.getByTestId("payment-save").click();
    await expect(page.getByTestId("doc-status")).toContainText(/en partie/i);
    await expect(page.getByTestId("doc-balance")).toContainText("15");
    await page.getByTestId("doc-pay").click();
    await page.getByTestId("payment-amount").fill("999999");
    await page.getByTestId("payment-save").click();
    await expect(page.getByRole("alert").filter({ hasText: /dépasse/ })).toBeVisible();
    await page.getByTestId("payment-amount").fill("15000");
    await page.getByTestId("payment-save").click();
    await expect(page.getByTestId("doc-status")).toContainText(/pay/i);
    await expect(page.getByTestId("payments").getByRole("listitem")).toHaveCount(2);

    // PDF is really served
    const frame = page.getByTestId("pdf-frame");
    const src = await frame.getAttribute("src");
    expect(src).toContain("/pdf");
    const res = await page.request.get(src!.split("#")[0]);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
  });

  test("with the mail module configured the send dialog sends by e-mail", async ({ page }) => {
    await resetMock(true);
    await loginAs(page, "accounting");
    await page.goto("/documents/new?type=INVOICE");
    await page.getByTestId("customer-picker").fill("Jean");
    await page.getByRole("option", { name: /Jean Baptiste/ }).click();
    await page.locator("#l-desc-0").fill("Impression de cartes");
    await page.getByTestId("line-price").first().fill("100");
    await page.getByTestId("doc-save").click();
    await page.getByTestId("doc-send").click();
    await page.getByTestId("send-confirm").click();
    await expect(page.getByTestId("doc-status")).toContainText(/envoy/i);
  });

  test("void requires a reason; sales cannot touch invoices", async ({ page }) => {
    await loginAs(page, "accounting");
    await page.goto("/documents/new?type=INVOICE");
    await page.getByTestId("customer-picker").fill("Marie");
    await page.getByRole("option", { name: /Marie Louis/ }).click();
    await page.locator("#l-desc-0").fill("Banderole 2 m");
    await page.getByTestId("line-price").first().fill("250");
    await page.getByTestId("doc-save").click();
    await page.getByTestId("doc-send").click();
    await page.getByTestId("mark-sent").click();
    await page.getByTestId("doc-void").click();
    await page.getByTestId("confirm-ok").click(); // no reason: server rejects
    await expect(page.getByTestId("doc-status")).not.toContainText(/annul/i);
    await page.getByTestId("void-reason").fill("Erreur de saisie");
    await page.getByTestId("confirm-ok").click();
    await expect(page.getByTestId("doc-status")).toContainText(/annul/i);

    await page.getByTestId("user-menu").click();
    await page.getByTestId("logout").click();
    await loginAs(page, "sales");
    await page.goto("/factures");
    await expect(page.getByTestId("doc-new")).toHaveCount(0);
  });

  test("lists filter by status and export CSV link exists", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/devis");
    await expect(page.getByTestId("export-csv")).toHaveAttribute("href", /export\.csv\?type=QUOTE/);
    await page.getByTestId("docs-status").selectOption("SENT");
    await expect(page.getByText(/aucun/i).first()).toBeVisible();
  });
});

test.describe("customers, products, reports", () => {
  test("create and edit a customer", async ({ page }) => {
    await loginAs(page, "sales");
    await page.goto("/clients");
    await page.getByTestId("customer-new").click();
    await page.locator("#c-name").fill("Nadège Pierre");
    await page.locator("#c-email").fill("nadege@example.com");
    await page.getByTestId("customer-save").click();
    await expect(page.getByTestId("customers-rows")).toContainText("Nadège Pierre");
    await page.getByRole("link", { name: "Nadège Pierre" }).click();
    await expect(page.getByRole("heading", { name: "Nadège Pierre" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Soldes" })).toBeVisible();
    await page.getByTestId("customer-edit").click();
    await page.locator("#c-company").fill("Pierre & Fils");
    await page.getByTestId("customer-save").click();
    await expect(page.getByText("Pierre & Fils").first()).toBeVisible();
  });

  test("edit a product's price tiers with validation", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/produits");
    await page.getByRole("link", { name: "Tasse sublimation" }).click();
    await page.getByTestId("tier-qty").last().fill("3"); // not strictly ascending
    await page.getByTestId("product-save").click();
    await expect(page.getByTestId("product-errors")).toContainText(/croissantes/);
    await page.getByTestId("tier-qty").last().fill("100");
    await page.getByTestId("tier-price").last().fill("350");
    await page.getByTestId("product-save").click();
    await expect(page.getByTestId("product-errors")).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("tier-price").last()).toHaveValue("350.00");
  });

  test("production role sees products read-only", async ({ page }) => {
    await loginAs(page, "production");
    await page.goto("/produits");
    await page.getByRole("link", { name: "Tasse sublimation" }).click();
    await expect(page.getByTestId("product-save")).toHaveCount(0);
  });

  test("reports page renders", async ({ page }) => {
    await loginAs(page, "accounting");
    await page.goto("/rapports");
    await expect(page.getByRole("heading", { name: "Rapports" })).toBeVisible();
    await expect(page.getByTestId("export-csv")).toBeVisible();
  });
});

test.describe("administration", () => {
  test("create staff user: temporary password shown once", async ({ page }) => {
    await loginAs(page, "superadmin");
    await page.goto("/utilisateurs");
    await page.getByTestId("user-new").click();
    await page.getByTestId("user-create").click(); // empty form → validation
    await expect(page.getByText("Nom complet requis.")).toBeVisible();
    await page.getByTestId("user-name").fill("Nouveau Vendeur");
    await page.getByTestId("user-email").fill("vendeur@impactpro.test");
    await page.getByTestId("user-create").click();
    const pwd = page.getByTestId("temp-password");
    await expect(pwd).toBeVisible();
    const value = (await pwd.textContent())!.trim();
    expect(value.length).toBeGreaterThanOrEqual(12);
    await page.getByTestId("temp-close").click();
    await expect(page.getByTestId("temp-password")).toHaveCount(0);
    await expect(page.getByTestId("users-rows")).toContainText("vendeur@impactpro.test");
    // the new account can sign in with that password and must change it
    await page.getByTestId("user-menu").click();
    await page.getByTestId("logout").click();
    await login(page, "vendeur@impactpro.test", value);
    await expect(page).toHaveURL(/changer-mot-de-passe/);
  });

  test("role change and activation toggle", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/utilisateurs");
    const row = page.getByTestId("users-rows").getByRole("row").filter({ hasText: "sales@impactpro.test" });
    await row.getByTestId("user-role-select").selectOption("SUPPORT");
    await expect(page.getByText("Utilisateur mis à jour.")).toBeVisible();
    await row.getByTestId("user-toggle").click();
    await expect(row).toContainText(/désactivé/i);
  });

  test("settings save with validation", async ({ page }) => {
    await loginAs(page, "accounting");
    await page.goto("/parametres");
    await page.getByTestId("set-taxRate").fill("150");
    await page.getByTestId("settings-save").click();
    await expect(page.getByText("Entre 0 et 100.")).toBeVisible();
    await page.getByTestId("set-taxRate").fill("7");
    await page.getByTestId("set-prefix-quote").fill("DV");
    await page.getByTestId("settings-save").click();
    await expect(page.getByText("Paramètres enregistrés.")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("set-prefix-quote")).toHaveValue("DV");
  });

  test("audit log lists the actions performed", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/audit");
    await expect(page.getByTestId("audit-rows")).toContainText("Connexion");
  });

  test("mail page: not configured → setup steps; configured → connected", async ({ page }) => {
    await loginAs(page, "sales");
    await page.goto("/messagerie");
    await expect(page.getByTestId("mail-not-configured-page")).toContainText("Messagerie non configurée");
    await setMail(true);
    await page.reload();
    await expect(page.getByTestId("mail-configured")).toBeVisible();
  });
});
