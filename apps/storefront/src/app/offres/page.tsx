import type { Metadata } from "next";
import Link from "next/link";
import { ApiUnavailable } from "@/components/api-unavailable";
import { PageHeader } from "@/components/page-header";
import { ProductCard } from "@/components/product-card";
import { listProducts, type Product } from "@/lib/api";
import { toNumber } from "@/lib/pricing";
import { discountPercent } from "@/lib/utils";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Offres",
  description: "Jusqu'à 30 % de rabais sur une sélection d'articles promotionnels personnalisés Impact Pro.",
  alternates: { canonical: "/offres" },
};

export default async function OffersPage() {
  let products: Product[] | null = null;
  try {
    products = await listProducts();
  } catch {
    products = null;
  }
  const deals = (products ?? [])
    .map((p) => ({ p, pct: discountPercent(toNumber(p.basePrice), p.compareAtPrice ? toNumber(p.compareAtPrice) : undefined) ?? 0 }))
    .filter((d) => d.pct > 0)
    .sort((a, b) => b.pct - a.pct);

  return (
    <>
      <PageHeader title="Offres du moment" intro="Jusqu'à 30 % de rabais sur une sélection d'articles." crumbs={[{ label: "Offres" }]} />
      <div className="container-ip py-10">
        {products === null ? (
          <ApiUnavailable />
        ) : deals.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-ip-line bg-ip-mist px-6 py-14 text-center">
            <h2 className="text-xl font-semibold">Pas d&apos;offre en cours</h2>
            <p className="mt-1 text-sm text-ip-muted">Nos prix dégressifs s&apos;appliquent toute l&apos;année dès les premières quantités.</p>
            <Link href="/produits" className="mt-5 inline-flex h-11 items-center rounded-xl bg-ip-sun px-5 text-sm font-semibold text-ip-ink hover:bg-ip-sun-600">
              Voir les produits
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {deals.map(({ p }) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
        <p className="mt-8 text-xs text-ip-muted">Le prix final est calculé à la validation de votre commande. Quantités minimales applicables.</p>
      </div>
    </>
  );
}
