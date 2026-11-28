import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Paintbrush } from "lucide-react";
import { ApiUnavailable } from "@/components/api-unavailable";
import { CategoryStage } from "@/components/category-stage";
import { ProductCard } from "@/components/product-card";
import { GhostLink, PrimaryLink, ServiceHero } from "@/components/service-hero";
import { promoCategories, promoCategory, quoteHref } from "@/config/offer";
import { listProducts, type Product } from "@/lib/api";

export const revalidate = 300;

type Params = Promise<{ categorie: string }>;

export function generateStaticParams() {
  return promoCategories.map((c) => ({ categorie: c.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const c = promoCategory((await params).categorie);
  if (!c) return { title: "Articles promotionnels" };
  return {
    title: `${c.name} · Articles promotionnels`,
    description: c.description,
    alternates: { canonical: `/articles-promotionnels/${c.slug}` },
  };
}

export default async function PromoCategoryPage({ params }: { params: Params }) {
  const c = promoCategory((await params).categorie);
  if (!c) notFound();

  let products: Product[] | null;
  try {
    const all = await listProducts();
    products = c.productSlugs.map((s) => all.find((p) => p.slug === s)).filter((p): p is Product => Boolean(p));
  } catch {
    products = null;
  }
  const others = promoCategories.filter((o) => o.slug !== c.slug);

  return (
    <>
      <ServiceHero
        eyebrow={c.kicker}
        title={c.name}
        intro={c.description}
        crumbs={[{ label: "Articles promotionnels", href: "/articles-promotionnels" }, { label: c.name }]}
        aside={
          <div className="relative hidden h-[320px] overflow-hidden rounded-3xl lg:block">
            <CategoryStage slug={c.slug} />
          </div>
        }
      >
        <PrimaryLink href={quoteHref("articles")}>
          Demander une proforma <ArrowRight className="size-[18px]" aria-hidden="true" />
        </PrimaryLink>
        <GhostLink href="/personnaliser">
          <Paintbrush className="size-[18px]" aria-hidden="true" /> Personnaliser en ligne
        </GhostLink>
      </ServiceHero>

      <section aria-labelledby="groups-title" className="container-ip py-14">
        <h2 id="groups-title" className="text-2xl font-semibold sm:text-3xl">
          Ce que nous proposons
        </h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {c.groups.map((g) => (
            <li key={g} className="flex items-center gap-3 rounded-2xl border border-ip-line bg-white p-4 font-semibold">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-ip-mist text-ip-teal">
                <Check className="size-5" strokeWidth={2.6} aria-hidden="true" />
              </span>
              {g}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-ip-muted">
          Idéal pour : {c.occasions.toLowerCase()}. Un article ne figure pas dans la liste ?{" "}
          <Link href="/sourcing" className="font-semibold text-ip-teal hover:underline">
            Nous le trouvons pour vous
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="products-title" className="bg-ip-mist py-14">
        <div className="container-ip">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="products-title" className="text-2xl font-semibold sm:text-3xl">
                À personnaliser en ligne
              </h2>
              <p className="mt-1 text-ip-muted">Ajoutez votre logo, voyez le rendu, puis envoyez votre demande de proforma.</p>
            </div>
            <Link href="/produits" className="inline-flex items-center gap-1.5 font-bold text-ip-teal hover:underline">
              Toute la boutique <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-8">
            {products === null ? (
              <ApiUnavailable />
            ) : products.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-ip-line bg-white p-8 text-center text-ip-muted">
                Les articles de cette catégorie se commandent sur demande.{" "}
                <Link href={quoteHref("articles")} className="font-semibold text-ip-teal hover:underline">
                  Demander une proforma
                </Link>
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {products.map((p) => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="other-title" className="container-ip py-14">
        <h2 id="other-title" className="text-2xl font-semibold">
          Autres catégories
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {others.map((o) => (
            <Link key={o.slug} href={`/articles-promotionnels/${o.slug}`} className="group flex items-center justify-between gap-4 rounded-2xl border border-ip-line bg-white p-5 hover:border-ip-teal">
              <span>
                <span className="block font-heading text-xl font-semibold group-hover:text-ip-teal">{o.name}</span>
                <span className="text-sm text-ip-muted">{o.short}</span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-ip-teal" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
