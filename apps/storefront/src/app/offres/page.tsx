import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ProductCard } from "@/components/product-card";
import { products } from "@/lib/catalog";
import { discountPercent } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Offres",
  description: "Jusqu'à 30 % de rabais sur une sélection d'articles promotionnels personnalisés Impact Pro.",
  alternates: { canonical: "/offres" },
};

export default function OffersPage() {
  const deals = products
    .map((p) => ({ p, pct: discountPercent(p.priceHTG, p.oldPriceHTG) ?? 0 }))
    .filter((d) => d.pct > 0)
    .sort((a, b) => b.pct - a.pct);
  return (
    <>
      <PageHeader title="Offres du moment" intro="Jusqu'à 30 % de rabais sur une sélection d'articles." crumbs={[{ label: "Offres" }]} />
      <div className="container-ip py-10">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {deals.map(({ p }) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
        <p className="mt-8 text-xs text-ip-muted">Offres indicatives, confirmées dans votre devis. Quantités minimales applicables.</p>
      </div>
    </>
  );
}
