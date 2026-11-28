/**
 * Phone case templates per phone model (« Modèle du téléphone » option of the coque-telephone product).
 * Each template is a generated, copyright-free case with the camera island of that phone family; the photo
 * the customer sends fills the whole back window of the template.
 */
export type PhoneTemplate = "iphone-dual" | "iphone-triple" | "samsung-s" | "samsung-a" | "android-module" | "android-round";

export const PHONE_TEMPLATE_LABELS: Record<PhoneTemplate, string> = {
  "iphone-dual": "iPhone — double objectif",
  "iphone-triple": "iPhone Pro — triple objectif",
  "samsung-s": "Samsung Galaxy S — 3 objectifs",
  "samsung-a": "Samsung Galaxy A — bandeau vertical",
  "android-module": "Android — module rectangulaire",
  "android-round": "Android — module rond",
};

/** Exact model strings of the catalog (API seed). */
const EXACT: Record<string, PhoneTemplate> = {
  "iPhone 11": "iphone-dual",
  "iPhone 11 Pro": "iphone-triple",
  "iPhone 11 Pro Max": "iphone-triple",
  "iPhone 12": "iphone-dual",
  "iPhone 12 mini": "iphone-dual",
  "iPhone 12 Pro": "iphone-triple",
  "iPhone 12 Pro Max": "iphone-triple",
  "iPhone 13": "iphone-dual",
  "iPhone 13 mini": "iphone-dual",
  "iPhone 13 Pro": "iphone-triple",
  "iPhone 13 Pro Max": "iphone-triple",
  "iPhone 14": "iphone-dual",
  "iPhone 14 Plus": "iphone-dual",
  "iPhone 14 Pro": "iphone-triple",
  "iPhone 14 Pro Max": "iphone-triple",
  "iPhone 15": "iphone-dual",
  "iPhone 15 Plus": "iphone-dual",
  "iPhone 15 Pro": "iphone-triple",
  "iPhone 15 Pro Max": "iphone-triple",
  "iPhone 16": "iphone-dual",
  "iPhone 16 Plus": "iphone-dual",
  "iPhone 16 Pro": "iphone-triple",
  "iPhone 16 Pro Max": "iphone-triple",
  "Samsung Galaxy A14": "samsung-a",
  "Samsung Galaxy A15": "samsung-a",
  "Samsung Galaxy A24": "samsung-a",
  "Samsung Galaxy A25": "samsung-a",
  "Samsung Galaxy A34": "samsung-a",
  "Samsung Galaxy A35": "samsung-a",
  "Samsung Galaxy A54": "samsung-a",
  "Samsung Galaxy A55": "samsung-a",
  "Samsung Galaxy S22": "samsung-s",
  "Samsung Galaxy S23": "samsung-s",
  "Samsung Galaxy S24": "samsung-s",
  "Samsung Galaxy S24 Ultra": "samsung-s",
  "Tecno Spark 10": "android-module",
  "Tecno Camon 20": "android-round",
  "Infinix Hot 30": "android-module",
  "Infinix Note 30": "android-module",
  "Xiaomi Redmi 12": "android-module",
  "Xiaomi Redmi Note 12": "android-module",
  "Autre modèle (précisez en notes)": "iphone-dual",
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const EXACT_NORM = new Map(Object.entries(EXACT).map(([k, v]) => [norm(k), v]));

/** Template for a model string; tolerant to unknown spellings, unknown / empty → `iphone-dual`. */
export function templateForModel(model?: string | null): PhoneTemplate {
  if (!model) return "iphone-dual";
  const n = norm(model);
  const exact = EXACT_NORM.get(n);
  if (exact) return exact;
  if (n.includes("iphone")) return /pro|max/.test(n) ? "iphone-triple" : "iphone-dual";
  if (n.includes("samsung") || n.includes("galaxy")) return /\bs\d{2}/.test(n) ? "samsung-s" : "samsung-a";
  if (n.includes("camon")) return "android-round";
  if (/tecno|infinix|xiaomi|redmi|poco|itel|oppo|realme|vivo|android/.test(n)) return "android-module";
  return "iphone-dual";
}
