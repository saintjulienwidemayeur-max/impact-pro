import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Passw0rd-test-12";
export const MOCK = `http://localhost:${process.env.MOCK_API_PORT ?? 4101}`;
export const REAL = Boolean(process.env.E2E_REAL_API);

export type Role = "superadmin" | "admin" | "sales" | "accounting" | "production" | "support";

/** Reset the mock API state (no-op against the real API). */
export async function resetMock(mailConfigured = false): Promise<void> {
  if (REAL) return;
  await fetch(`${MOCK}/__reset`, { method: "POST" });
  if (mailConfigured) await fetch(`${MOCK}/__mail`, { method: "POST", body: JSON.stringify({ configured: true }) });
}

export async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();
}

export async function loginAs(page: Page, role: Role): Promise<void> {
  await login(page, `${role}@impactpro.test`);
  await expect(page.getByTestId("user-menu")).toBeVisible();
}

/** Toggle the mail module on the mock without dropping sessions. */
export async function setMail(configured: boolean): Promise<void> {
  if (REAL) return;
  await fetch(`${MOCK}/__mail`, { method: "POST", body: JSON.stringify({ configured }) });
}
