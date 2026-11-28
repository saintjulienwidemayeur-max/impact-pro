import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { ApiUnavailable } from "@/components/api-unavailable";
import { PageHeader } from "@/components/page-header";
import { ProductCard } from "@/components/product-card";
import { listProducts, type Product } from "@/lib/api";
import { cn } from "@/lib/utils";

export const revalidate = 60;

type SearchParams = Promise<{ q?: string | string[]; categorie?: string | string[] }>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const categorie = first((await searchParams).categorie);
  return {
    title: "Produits",
    description:
      "Catalogue d'articles promotionnels personnalisés : tasses, textiles, casquettes, banderoles, drapeaux, cartes, carnets, stylos et photocalls.",
    alternates: { canonical: categorie ? `/produits?categorie=${encodeURIComponent(categorie)}` : "/produits" },
  };
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = first(sp.q)?.slice(0, 100) ?? "";
  const categorie = first(sp.categorie) ?? "";

  let products: Product[] | null = null;
  try {
    products = await listProducts();
  } catch {
    products = null;
  }

  const categories = Array.from(new Map((products ?? []).map((p) => [p.category.slug, p.category])).values());
  const category = categories.find((c) => c.slug === categorie);
  const terms = normalize(q.trim()).split(/\s+/).filter(Boolean);
  const results = (products ?? []).filter((p) => {
    if (category && p.category.slug !== category.slug) return false;
    if (!terms.length) return true;
    const haystack = normalize(`${p.name} ${p.description ?? ""} ${p.category.name}`);
    return terms.every((t) => haystack.includes(t));
  });

  const href = (cat?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (cat) params.set("categorie", cat);
    const s = params.toString();
    return s ? `/produits?${s}` : "/produits";
  };

  return (
    <>
      <PageHeader
        title={category ? category.name : "Nos produits"}
        intro="Choisissez un article, ajoutez votre logo et commandez en quelques minutes."
        crumbs={[{ label: "Produits", href: "/produits" }, ...(category ? [{ label: category.name }] : [])]}
      />
      <div className="container-ip grid gap-8 py-10 lg:grid-cols-[240px_1fr]">
        <aside aria-label="Filtres">
          <form action="/produits" method="get" className="mb-6" role="search">
            <label htmlFor="q" className="mb-1.5 block text-sm font-semibold">
              Recherche
            </label>
            {category && <input type="hidden" name="categorie" value={category.slug} />}
            <div className="flex gap-2">
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="ex. tasse, polo…"
                className="h-10 w-full rounded-xl border border-ip-line px-3 text-sm focus:border-ip-teal focus:outline-none focus:ring-2 focus:ring-ip-cyan/50"
              />
              <button type="submit" className="h-10 rounded-xl bg-ip-teal px-3 text-sm font-semibold text-white hover:bg-ip-teal-600">
                OK
              </button>
            </div>
          </form>
          {categories.length > 0 && (
            <>
              <h2 className="mb-2 text-sm font-semibold">Catégories</h2>
              <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
                <li>
                  <Link
                    href={href()}
                    aria-current={!category ? "page" : undefined}
                    className={cn("block rounded-lg px-3 py-2 text-sm hover:bg-ip-mist", !category && "bg-ip-mist font-semibold text-ip-teal")}
                  >
                    Toutes
                  </Link>
                </li>
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={href(c.slug)}
                      aria-current={category?.slug === c.slug ? "page" : undefined}
                      className={cn("block rounded-lg px-3 py-2 text-sm hover:bg-ip-mist", category?.slug === c.slug && "bg-ip-mist font-semibold text-ip-teal")}
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
        <section aria-live="polite">
          {products === null ? (
            <ApiUnavailable />
          ) : (
            <>
              <p className="mb-4 text-sm text-ip-muted">
                {results.length} produit{results.length > 1 ? "s" : ""}
                {q && (
                  <>
                    {" "}
                    pour « <strong className="text-ip-ink">{q}</strong> »
                  </>
                )}
              </p>
              {results.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-4">
                  {results.map((p) => (
                    <ProductCard key={p.slug} product={p} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-ip-line bg-ip-mist px-6 py-14 text-center">
                  <SearchX className="size-10 text-ip-teal" aria-hidden="true" />
                  <h2 className="mt-3 text-xl font-semibold">Aucun produit trouvé</h2>
                  <p className="mt-1 max-w-md text-sm text-ip-muted">
                    Essayez un autre mot-clé, ou décrivez-nous votre besoin : nous trouvons l&apos;article idéal pour votre marque.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <Link href="/produits" className="inline-flex h-11 items-center rounded-xl border-2 border-ip-teal px-5 text-sm font-semibold text-ip-teal hover:bg-ip-teal hover:text-white">
                      Voir tout le catalogue
                    </Link>
                    <Link href="/devis" className="inline-flex h-11 items-center rounded-xl bg-ip-sun px-5 text-sm font-semibold text-ip-ink hover:bg-ip-sun-600">
                      Demander un devis
                    </Link>
                  </div>
                </div>
              )}
              <p className="mt-8 text-xs text-ip-muted">Les prix sont communiqués sur proforma après votre demande.</p>
            </>
          )}
        </section>
      </div>
    </>
  );
}
