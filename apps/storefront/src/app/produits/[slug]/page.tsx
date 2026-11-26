import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, FileText } from "lucide-react";
import { AddToCartForm } from "@/components/add-to-cart";
import { PageHeader } from "@/components/page-header";
import { ProductCard } from "@/components/product-card";
import { ProductVisual } from "@/components/product-visual";
import { getCategory, getProduct, products } from "@/lib/catalog";
import { site } from "@/lib/site";
import { discountPercent, formatHTG } from "@/lib/utils";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = getProduct((await params).slug);
  if (!product) return { title: "Produit introuvable" };
  return {
    title: product.name,
    description: `${product.name} personnalisé — ${product.shortDescription}. À partir de ${formatHTG(product.priceHTG)} par ${product.unit}.`,
    alternates: { canonical: `/produits/${product.slug}` },
    openGraph: { title: `${product.name} · ${site.name}`, description: product.description },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const product = getProduct((await params).slug);
  if (!product) notFound();
  const category = getCategory(product.category);
  const pct = discountPercent(product.priceHTG, product.oldPriceHTG);
  const related = products.filter((p) => p.slug !== product.slug && p.category === product.category).slice(0, 3);
  const others = related.length ? related : products.filter((p) => p.slug !== product.slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    brand: { "@type": "Brand", name: site.name },
    offers: { "@type": "Offer", priceCurrency: "HTG", price: product.priceHTG, availability: "https://schema.org/InStock" },
  };

  return (
    <>
      <PageHeader
        title={product.name}
        crumbs={[
          { label: "Produits", href: "/produits" },
          ...(category ? [{ label: category.name, href: `/produits?categorie=${category.slug}` }] : []),
          { label: product.name },
        ]}
      />
      <div className="container-ip grid gap-10 py-10 lg:grid-cols-2">
        <div className="relative aspect-[5/4] rounded-[1.5rem] bg-ip-mist p-6">
          {pct && <span className="absolute left-4 top-4 rounded-lg bg-ip-sun px-2 py-1 text-sm font-bold">-{pct} %</span>}
          <ProductVisual product={product} />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-ip-teal">{product.technique}</p>
          <h2 className="mt-1 text-3xl font-bold">{product.name}</h2>
          <p className="mt-3 text-ip-muted">{product.description}</p>
          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-3xl font-bold">{formatHTG(product.priceHTG)}</span>
            {product.oldPriceHTG && (
              <span className="text-ip-muted line-through">
                <span className="sr-only">Prix habituel : </span>
                {formatHTG(product.oldPriceHTG)}
              </span>
            )}
            <span className="text-sm text-ip-muted">/ {product.unit}</span>
          </div>
          <ul className="mt-5 space-y-2">
            {product.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <Check className="size-4 text-ip-teal" aria-hidden="true" /> {f}
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-2xl border border-ip-line p-5">
            <AddToCartForm product={product} />
            <Link href="/devis" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-ip-teal hover:underline">
              <FileText className="size-4" aria-hidden="true" /> Besoin d&apos;un devis sur mesure ?
            </Link>
          </div>
        </div>
      </div>
      <section aria-labelledby="related-title" className="container-ip pb-16">
        <h2 id="related-title" className="mb-4 text-2xl font-bold">
          Vous aimerez aussi
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
          {others.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
