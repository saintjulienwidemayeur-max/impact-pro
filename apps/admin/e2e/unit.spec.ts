// "Unit" tests run through Playwright (no browser) so the project needs no second test runner.
// Relative imports on purpose: the `@/` alias is not resolved here.
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import fallbackVectors from "../src/lib/billing-vectors.json";
import { can, canAny, documentReadPerm, documentWritePerm, roleLabel } from "../src/lib/permissions";
import { computeTotals, round2 } from "../src/lib/totals";

type Vector = { name: string; input: Parameters<typeof computeTotals>[0]; expected: Record<string, unknown> };

/** Prefer the API's shared fixture when it exists with the same shape; otherwise the local copy. */
function loadVectors(): Vector[] {
  const shared = path.resolve(__dirname, "../../api/test/fixtures/billing-vectors.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(shared, "utf8"));
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].input && parsed[0].expected?.total !== undefined) return parsed as Vector[];
  } catch {
    /* fixture not merged yet */
  }
  return fallbackVectors as unknown as Vector[];
}

test.describe("computeTotals — shared billing vectors", () => {
  for (const v of loadVectors()) {
    test(v.name, () => {
      const out = computeTotals(v.input);
      const e = v.expected as { lineTotals?: string[]; subtotal?: string; taxTotal?: string; total?: string; amountPaid?: string; balance?: string };
      if (e.lineTotals) expect(out.lineTotals).toEqual(e.lineTotals);
      for (const k of ["subtotal", "taxTotal", "total", "amountPaid", "balance"] as const) if (e[k] !== undefined) expect(out[k]).toBe(e[k]);
    });
  }
});

test("round2 rounds half away from zero", () => {
  expect(round2(0.125)).toBe(0.13);
  expect(round2(1.005)).toBe(1.01);
  expect(round2(-0.125)).toBe(-0.13);
  expect(round2(2.5)).toBe(2.5);
});

test("permission helpers", () => {
  const sales = { permissions: ["orders.read", "quotes.write"] };
  expect(can(sales, "orders.read")).toBe(true);
  expect(can(sales, "invoices.write")).toBe(false);
  expect(can(null, "orders.read")).toBe(false);
  expect(canAny(sales, ["users.manage", "quotes.write"])).toBe(true);
  expect(documentReadPerm("INVOICE")).toBe("invoices.read");
  expect(documentReadPerm("PROFORMA")).toBe("quotes.read");
  expect(documentWritePerm("QUOTE")).toBe("quotes.write");
  expect(roleLabel("ACCOUNTING")).not.toBe("ACCOUNTING");
});
