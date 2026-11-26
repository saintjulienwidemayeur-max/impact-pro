import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, FileText, Paintbrush } from "lucide-react";
import { ApiUnavailable } from "@/components/api-unavailable";
import { PageHeader } from "@/components/page-header";
import { ProductCard } from "@/components/product-card";
import { productPhotos } from "@/config/product-media";
import { getProduct, listProducts, placementLabels, type Product } from "@/lib/api";
import { sortedTiers, toNumber } from "@/lib/pricing";
import { site } from "@/lib/site";
import { discountPercent, formatHTG } from "@/lib/utils";

export const revalidate = 60;

type Params = Promise<{ slug: string }>;

async function load(slug: string): Promise<{ product: Product | null; failed: boolean }> {
  try {
    return { product: await getProduct(slug), failed: false };
  } catch {
    return { product: null, failed: true };
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { product } = await load((await params).slug);
  if (!product) return { title: "Produit" };
  const photo = productPhotos(product)[0];
  return {
    title: product.name,
    description: `${product.name} personnalisé avec votre logo. À partir de ${formatHTG(toNumber(product.basePrice))} par ${product.unitLabel}.`,
    alternates: { canonical: `/produits/${product.slug}` },
    openGraph: { title: `${product.name} · ${site.name}`, description: product.description ?? undefined, images: photo ? [photo.src] : undefined },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const { product, failed } = await load(slug);
  if (failed) {
    return (
      <>
        <PageHeader title="Produit" crumbs={[{ label: "Produits", href: "/produits" }]} />
        <div className="container-ip py-10">
          <ApiUnavailable title="Produit momentanément indisponible" />
        </div>
      </>
    );
  }
  if (!product) notFound();

  const gallery = productPhotos(product);
  const price = toNumber(product.basePrice);
  const compare = product.compareAtPrice ? toNumber(product.compareAtPrice) : undefined;
  const pct = discountPercent(price, compare);
  const tiers = sortedTiers(product.priceTiers);

  let others: Product[] = [];
  try {
    const all = await listProducts();
    const same = all.filter((p) => p.slug !== product.slug && p.category.slug === product.category.slug);
    others = (same.length ? same : all.filter((p) => p.slug !== product.slug)).slice(0, 3);
  } catch {
    others = [];
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: gallery.map((g) => `${site.url}${g.src}`),
    brand: { "@type": "Brand", name: site.name },
    offers: { "@type": "Offer", priceCurrency: "HTG", price, availability: "https://schema.org/InStock" },
  };

  return (
    <>
      <PageHeader
        title={product.name}
        crumbs={[
          { label: "Produits", href: "/produits" },
          { label: product.category.name, href: `/produits?categorie=${product.category.slug}` },
          { label: product.name },
        ]}
      />
      <div className="container-ip grid gap-10 py-10 lg:grid-cols-2">
        <div className="space-y-3">
          {gallery.length > 0 ? (
            gallery.map((ph, i) => (
              <div
                key={ph.src}
                className="relative overflow-hidden rounded-[1.5rem] border border-ip-line bg-white"
                style={{ aspectRatio: `${ph.width} / ${ph.height}` }}
              >
                {i === 0 && pct && <span className="absolute left-4 top-4 z-10 rounded-lg bg-ip-sun px-2 py-1 text-sm font-bold">-{pct} %</span>}
                <Image src={ph.src} alt={ph.alt} fill priority={i === 0} sizes="(min-width: 1024px) 50vw, 100vw" className="object-contain" />
              </div>
            ))
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-[1.5rem] bg-ip-mist text-sm text-ip-muted">Photo à venir</div>
          )}
        </div>
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-sm font-semibold uppercase tracking-wide text-ip-teal">{product.category.name}</p>
          <h2 className="mt-1 text-3xl font-bold">{product.name}</h2>
          {product.description && <p className="mt-3 text-ip-muted">{product.description}</p>}
          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-bold">{formatHTG(price)}</span>
            {compare && compare > price && (
              <span className="text-ip-muted line-through">
                <span className="sr-only">Prix habituel : </span>
                {formatHTG(compare)}
              </span>
            )}
            <span className="text-sm text-ip-muted">
              / {product.unitLabel} · min. {product.minQty}
            </span>
          </div>

          {tiers.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Prix dégressifs">
              {tiers.map((t) => (
                <li key={t.minQty} className="rounded-lg border border-ip-line bg-ip-mist px-3 py-1.5 text-xs">
                  <span className="font-semibold">{t.minQty}+</span> : {formatHTG(toNumber(t.unitPrice))}
                </li>
              ))}
            </ul>
          )}

          <ul className="mt-5 space-y-2 text-sm">
            {product.placements.length > 0 && (
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-ip-teal" aria-hidden="true" />
                Marquage : {product.placements.map((p) => placementLabels[p] ?? p).join(", ")}
              </li>
            )}
            {product.colors.length > 0 && (
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-ip-teal" aria-hidden="true" />
                Couleurs : {product.colors.join(", ")}
              </li>
            )}
            {product.sizes.length > 0 && (
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-ip-teal" aria-hidden="true" />
                Tailles : {product.sizes.join(", ")}
              </li>
            )}
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-ip-teal" aria-hidden="true" />
              Maquette gratuite envoyée avant production
            </li>
          </ul>

          <div className="mt-6 rounded-2xl border border-ip-line p-5">
            <Link
              href={`/personnaliser/${product.slug}`}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ip-sun px-6 font-bold text-ip-ink hover:bg-ip-sun-600"
            >
              <Paintbrush className="size-4" aria-hidden="true" /> Personnaliser ce produit <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <p className="mt-3 text-xs text-ip-muted">Ajoutez votre logo, voyez l&apos;aperçu, choisissez la quantité et commandez.</p>
            <Link href="/devis" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-ip-teal hover:underline">
              <FileText className="size-4" aria-hidden="true" /> Besoin d&apos;un devis sur mesure ?
            </Link>
          </div>
        </div>
      </div>
      {others.length > 0 && (
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
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
