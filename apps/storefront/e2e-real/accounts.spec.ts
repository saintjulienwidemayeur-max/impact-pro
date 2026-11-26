import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Customer accounts against the REAL API (see playwright.accounts.config.ts). Everything the browser sends for auth goes
 * to the STOREFRONT origin (rewrites proxy it to the API), which is what makes the session cookie first-party.
 */
const WEB = `http://localhost:${process.env.ACCOUNTS_WEB_PORT ?? 3350}`;
const API = `http://localhost:${process.env.ACCOUNTS_API_PORT ?? 4350}`;
const PASSWORD = "Cafe-Pwa-Nwa-2026!";

let counter = 0;
const uniqueEmail = (tag: string) => `${tag}.${Date.now().toString(36)}${counter++}@example.com`;

async function signUp(page: Page, opts: { name?: string; email?: string; password?: string; phone?: string } = {}) {
  const email = opts.email ?? uniqueEmail("marie");
  await page.goto("/inscription");
  await page.locator("#fullName").fill(opts.name ?? "Marie Joseph");
  await page.locator("#email").fill(email);
  if (opts.phone) await page.locator("#phone").fill(opts.phone);
  await page.locator("#password").fill(opts.password ?? PASSWORD);
  await page.locator("#acceptTerms").check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/compte", { timeout: 20_000 });
  await expect(page.getByTestId("account-email")).toHaveText(email);
  return email;
}

async function logIn(page: Page, email: string, password = PASSWORD, next?: string) {
  await page.goto(`/connexion${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

/** A one-line order (football + a text) placed through the real UI; returns the order reference. */
async function placeOrder(page: Page, opts: { email?: string; phone?: string } = {}): Promise<string> {
  await page.goto("/personnaliser/ballon-football");
  await page.getByTestId("add-text").click();
  await page.getByTestId("text-input").fill("Champions 2026");
  await page.locator("#cz-quantity").fill((await page.locator("#cz-quantity").getAttribute("min")) ?? "1");
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");
  await page.goto("/panier");
  await page.getByRole("link", { name: "Passer la commande" }).click();
  if (!(await page.locator("#fullName").inputValue())) await page.locator("#fullName").fill("Marie Joseph");
  if (!(await page.locator("#phone").inputValue())) await page.locator("#phone").fill(opts.phone ?? "+509 3712-3456");
  if (opts.email) await page.locator("#email").fill(opts.email);
  await page.getByRole("button", { name: "Confirmer la commande" }).click();
  await page.waitForURL(/\/commande\/confirmation\?ref=IP-/, { timeout: 60_000 });
  return (await page.getByTestId("order-ref").textContent())!.trim();
}

const cookieByName = async (ctx: BrowserContext, name: string) => (await ctx.cookies(WEB)).find((c) => c.name === name);

test.describe("customer accounts (real API)", () => {
  test("registers through the same-origin proxy and gets an HTTP-only session cookie on the storefront origin", async ({ page, context }) => {
    const apiHosts: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/v1/auth/")) apiHosts.push(new URL(r.url()).origin);
    });
    await signUp(page, { phone: "+509 3712-3456" });

    // Header: signed-in avatar link with the user's name.
    await expect(page.getByTestId("account-link")).toHaveAttribute("aria-label", /Marie Joseph/);
    // Same-origin: no auth call ever went to the API origin directly.
    expect(apiHosts.length).toBeGreaterThan(0);
    expect(new Set(apiHosts)).toEqual(new Set([WEB]));
    expect(apiHosts).not.toContain(API);

    // Cookies live on the storefront host: session HTTP-only + Lax, CSRF readable.
    const session = await cookieByName(context, "ip_session");
    const csrf = await cookieByName(context, "ip_csrf");
    expect(session).toBeTruthy();
    expect(session!.httpOnly).toBe(true);
    expect(session!.sameSite).toBe("Lax");
    expect(session!.path).toBe("/");
    expect(session!.value.length).toBeGreaterThanOrEqual(40);
    expect(csrf).toBeTruthy();
    expect(csrf!.httpOnly).toBe(false);
    // Script cannot read the session cookie, only the CSRF one.
    const visible = await page.evaluate(() => document.cookie);
    expect(visible).toContain("ip_csrf=");
    expect(visible).not.toContain("ip_session");

    // The session survives a reload (the provider re-reads GET /auth/me).
    await page.reload();
    await expect(page.getByTestId("account-name")).toHaveText("Marie Joseph");
  });

  test("shows password hints and API password-policy errors in French", async ({ page }) => {
    await page.goto("/inscription");
    await page.locator("#password").fill("abc");
    await expect(page.getByTestId("password-strength")).toContainText("Trop faible");
    await page.locator("#password").fill("Cafe-Pwa-Nwa-2026!");
    await expect(page.getByTestId("password-strength")).toContainText(/Bon|Excellent/);

    // Show / hide toggle.
    await expect(page.locator("#password")).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Afficher le mot de passe" }).click();
    await expect(page.locator("#password")).toHaveAttribute("type", "text");

    // Client validation first…
    await page.locator("#fullName").fill("Marie Joseph");
    await page.locator("#email").fill(uniqueEmail("pol"));
    await page.locator("#password").fill("short");
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.locator("#password-msg")).toContainText("au moins 10 caractères");
    await expect(page.locator("#acceptTerms-msg")).toContainText("conditions");
    // …then the server-side policy (a common password that passes the client rules).
    await page.locator("#password").fill("motdepasse123");
    await page.locator("#acceptTerms").check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.locator("#password-msg")).toContainText("trop courant");
    await expect(page).toHaveURL(/\/inscription/);
  });

  test("refuses a duplicate e-mail with a link to sign in", async ({ page, browser }) => {
    const email = await signUp(page);
    const second = await browser.newContext({ baseURL: WEB });
    const p2 = await second.newPage();
    await p2.goto("/inscription");
    await p2.locator("#fullName").fill("Autre Personne");
    await p2.locator("#email").fill(email);
    await p2.locator("#password").fill(PASSWORD);
    await p2.locator("#acceptTerms").check();
    await p2.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(p2.getByTestId("register-error")).toContainText("existe déjà");
    await expect(p2.getByTestId("register-error").getByRole("link", { name: "Se connecter" })).toBeVisible();
    await second.close();
  });

  test("signs out, redirects guests away from protected pages and honours ?next safely", async ({ page, context }) => {
    const email = await signUp(page);
    await page.getByTestId("logout").click();
    await page.waitForURL(WEB + "/");
    await expect(page.getByTestId("account-link")).toHaveAttribute("aria-label", "Se connecter");
    expect(await cookieByName(context, "ip_session")).toBeUndefined();

    // Guests: protected pages bounce to /connexion with a return path.
    await page.goto("/compte");
    await page.waitForURL(/\/connexion\?next=(%2F|\/)compte$/);
    await page.goto("/compte/commandes/IP-2026-000001");
    await page.waitForURL(/\/connexion\?next=/);

    // Wrong password: generic message, still on the page.
    await logIn(page, email, "wrong-password-123");
    await expect(page.getByTestId("login-error")).toHaveText("E-mail ou mot de passe incorrect.");
    await expect(page).toHaveURL(/\/connexion/);

    // Right password with a ?next → lands there; open redirects are ignored.
    await logIn(page, email, PASSWORD, "/panier");
    await page.waitForURL("**/panier");
    await page.getByTestId("account-link").click();
    await page.waitForURL("**/compte");
    await page.getByTestId("logout").click();
    await page.waitForURL(WEB + "/");
    await logIn(page, email, PASSWORD, "//evil.example");
    await page.waitForURL("**/compte");
    expect(new URL(page.url()).origin).toBe(WEB);

    // A signed-in user opening /connexion is sent to the account.
    await page.goto("/connexion");
    await page.waitForURL("**/compte");
  });

  test("a member's order goes through the proxy, is attached to the account and shows up in « Mes commandes »", async ({ page }) => {
    const email = await signUp(page, { phone: "+509 3712-3456" });
    const orderRequests: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && /\/api\/v1\/custom-orders$/.test(r.url())) orderRequests.push(new URL(r.url()).origin);
    });
    await page.goto("/personnaliser/ballon-football");
    await page.getByTestId("add-text").click();
    await page.getByTestId("text-input").fill("Champions 2026");
    await page.locator("#cz-quantity").fill((await page.locator("#cz-quantity").getAttribute("min")) ?? "1");
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await page.goto("/panier");
    await page.getByRole("link", { name: "Passer la commande" }).click();

    // Checkout is prefilled from the account.
    await expect(page.getByTestId("checkout-signed-in")).toContainText("Marie Joseph");
    await expect(page.locator("#fullName")).toHaveValue("Marie Joseph");
    await expect(page.locator("#email")).toHaveValue(email);
    await expect(page.locator("#phone")).toHaveValue("+509 3712-3456");
    await expect(page.getByTestId("checkout-account-banner")).toHaveCount(0);

    await page.getByRole("button", { name: "Confirmer la commande" }).click();
    await page.waitForURL(/\/commande\/confirmation\?ref=IP-/, { timeout: 60_000 });
    const ref = (await page.getByTestId("order-ref").textContent())!.trim();
    expect(orderRequests).toEqual([WEB]); // same-origin → the session cookie travelled
    await expect(page.getByTestId("confirmation-member")).toBeVisible();

    await page.goto("/compte");
    const row = page.getByTestId("order-row").filter({ hasText: ref });
    await expect(row).toBeVisible();
    await expect(row.getByTestId("order-status")).toHaveText("Commande reçue");
    await row.click();
    await page.waitForURL(`**/compte/commandes/${ref}`);
    await expect(page.getByTestId("order-ref")).toHaveText(ref);
  });

  test("a guest order can be attached by creating an account from the confirmation page", async ({ page }) => {
    const email = uniqueEmail("invite");
    const orderRequests: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && /\/api\/v1\/custom-orders$/.test(r.url())) orderRequests.push(new URL(r.url()).origin);
    });
    await page.goto("/personnaliser/ballon-football");
    await page.getByTestId("add-text").click();
    await page.getByTestId("text-input").fill("Invité");
    await page.locator("#cz-quantity").fill((await page.locator("#cz-quantity").getAttribute("min")) ?? "1");
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await page.goto("/panier");
    await page.getByRole("link", { name: "Passer la commande" }).click();
    await expect(page.getByTestId("checkout-account-banner")).toBeVisible(); // guest banner, checkout still open
    await page.locator("#fullName").fill("Client Invité");
    await page.locator("#phone").fill("+509 3712-3456");
    await page.locator("#email").fill(email);
    await page.getByRole("button", { name: "Confirmer la commande" }).click();
    await page.waitForURL(/\/commande\/confirmation\?ref=IP-/, { timeout: 60_000 });
    const ref = (await page.getByTestId("order-ref").textContent())!.trim();
    expect(orderRequests).toEqual([API]); // guests keep calling the API directly

    await page.getByTestId("confirmation-guest-cta").getByRole("link", { name: "Créer un compte" }).click();
    await page.waitForURL(/\/inscription\?/);
    await expect(page.locator("#email")).toHaveValue(email);
    await page.locator("#fullName").fill("Client Invité");
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#acceptTerms").check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await page.waitForURL("**/compte");
    await expect(page.getByTestId("order-row").filter({ hasText: ref })).toBeVisible({ timeout: 15_000 });
  });

  test("« Retrouver une commande » attaches a guest order with reference + e-mail", async ({ page, browser }) => {
    const buyer = uniqueEmail("buyer");
    const guest = await browser.newContext({ baseURL: WEB });
    const gp = await guest.newPage();
    const ref = await placeOrder(gp, { email: buyer });
    await guest.close();

    await signUp(page);
    await expect(page.getByTestId("orders-empty")).toBeVisible();
    await page.getByText("Retrouver une commande passée sans compte").click();
    await page.locator("#ref").fill(ref);
    await page.locator("#claimEmail").fill("someone-else@example.com");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Aucune commande ne correspond" })).toBeVisible();
    await page.locator("#claimEmail").fill(buyer);
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByTestId("order-row").filter({ hasText: ref })).toBeVisible({ timeout: 15_000 });
  });

  test("accounts are isolated: another customer gets « Commande introuvable » for someone else's order", async ({ page, browser }) => {
    await signUp(page);
    const ref = await placeOrder(page);
    const other = await browser.newContext({ baseURL: WEB });
    const op = await other.newPage();
    await signUp(op, { name: "Paul Jean" });
    await op.goto(`/compte/commandes/${ref}`);
    await expect(op.getByTestId("order-missing")).toBeVisible({ timeout: 15_000 });
    await expect(op.getByTestId("order-row")).toHaveCount(0);
    await other.close();
  });

  test("edits the profile and the header follows", async ({ page }) => {
    await signUp(page);
    await page.locator("#profile-name").fill("Marie-Claude Joseph");
    await page.locator("#profile-phone").fill("+1 305 555 0100");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByTestId("account-link")).toHaveAttribute("aria-label", /Marie-Claude Joseph/);
    await page.reload();
    await expect(page.getByTestId("account-name")).toHaveText("Marie-Claude Joseph");
    await expect(page.locator("#profile-phone")).toHaveValue("+1 305 555 0100");
    await page.locator("#profile-name").fill("M");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.locator("#profile-name-msg")).toContainText("nom complet");
  });

  test("changes the password: old one stops working, other devices are signed out, this one stays", async ({ page, browser }) => {
    const email = await signUp(page);
    const device2 = await browser.newContext({ baseURL: WEB });
    const p2 = await device2.newPage();
    await logIn(p2, email);
    await p2.waitForURL("**/compte");

    await page.locator("#current-password").fill("not-my-password-1");
    await page.locator("#new-password").fill("Another-Strong-Pass-9");
    await page.locator("#confirm-password").fill("Another-Strong-Pass-9");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(page.locator("#current-password-msg")).toContainText("actuel est incorrect");

    await page.locator("#current-password").fill(PASSWORD);
    await page.locator("#confirm-password").fill("Another-Strong-Pass-0");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(page.locator("#confirm-password-msg")).toContainText("ne correspondent pas");
    await page.locator("#confirm-password").fill("Another-Strong-Pass-9");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(page.getByText(/Mot de passe modifié/)).toBeVisible();

    // This device is still signed in; the other one is not.
    await page.reload();
    await expect(page.getByTestId("account-email")).toHaveText(email);
    await p2.reload();
    await p2.waitForURL(/\/connexion/);
    await device2.close();

    // Old password rejected, new one accepted.
    await page.getByTestId("logout").click();
    await page.waitForURL(WEB + "/");
    await logIn(page, email, PASSWORD);
    await expect(page.getByTestId("login-error")).toBeVisible();
    await logIn(page, email, "Another-Strong-Pass-9");
    await page.waitForURL("**/compte");
  });

  test("the « mot de passe oublié » page explains how to get help", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
    await page.waitForURL("**/mot-de-passe-oublie");
    await expect(page.getByRole("heading", { name: /retrouver l.accès/ })).toBeVisible();
    await expect(page.locator("#contenu").getByRole("link", { name: "Nous écrire" })).toHaveAttribute("href", "/contact");
  });
});
