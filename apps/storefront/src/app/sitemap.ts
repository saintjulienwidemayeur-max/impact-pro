import type { MetadataRoute } from "next";
import { navCategories } from "@/config/navigation";
import { listProducts, type Product } from "@/lib/api";
import { site } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url.replace(/\/$/, "");
  const now = new Date();
  const staticPages = ["", "/produits", "/personnaliser", "/offres", "/a-propos", "/contact", "/devis", "/suivi", "/conditions"].map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.7,
  }));
  let products: Product[] = [];
  try {
    products = await listProducts();
  } catch {
    // API unreachable: publish static pages only; the sitemap is regenerated hourly.
    products = [];
  }
  return [
    ...staticPages,
    ...navCategories.map((c) => ({ url: `${base}/produits?categorie=${c.slug}`, lastModified: now, priority: 0.6 })),
    ...products.flatMap((p) => [
      { url: `${base}/produits/${p.slug}`, lastModified: now, priority: 0.8 },
      { url: `${base}/personnaliser/${p.slug}`, lastModified: now, priority: 0.7 },
    ]),
  ];
}
