import type { MetadataRoute } from "next";
import { categories, products } from "@/lib/catalog";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url.replace(/\/$/, "");
  const now = new Date();
  const staticPages = ["", "/produits", "/personnaliser", "/offres", "/a-propos", "/contact", "/devis"].map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.7,
  }));
  return [
    ...staticPages,
    ...categories.map((c) => ({ url: `${base}/produits?categorie=${c.slug}`, lastModified: now, priority: 0.6 })),
    ...products.map((p) => ({ url: `${base}/produits/${p.slug}`, lastModified: now, priority: 0.8 })),
  ];
}
