import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Brush, Layers, Printer, Scissors, Sparkles, Stamp, type LucideIcon } from "lucide-react";
import { ApiUnavailable } from "@/components/api-unavailable";
import { PageHeader } from "@/components/page-header";
import { showcaseFor } from "@/config/product-media";
import { listProducts, type Product } from "@/lib/api";
import { lowestPrice } from "@/lib/pricing";
import { services } from "@/lib/site";
import { formatHTG } from "@/lib/utils";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Personnaliser",
  description: "Choisissez un article, téléversez votre logo, visualisez l'aperçu et commandez : tasses, polos, casquettes, banderoles, cartes et plus.",
  alternates: { canonical: "/personnaliser" },
};

const icons: Record<(typeof services)[number]["id"], LucideIcon> = {
  serigraphie: Layers,
  broderie: Scissors,
  sublimation: Sparkles,
  tampographie: Stamp,
  "grand-format": Printer,
  design: Brush,
};

export default async function CustomizePage() {
  let products: Product[] | null = null;
  try {
    products = await listProducts();
  } catch {
    products = null;
  }

  return (
    <>
      <PageHeader
        title="Personnalisez vos articles"
        intro="1. Choisissez un article · 2. Ajoutez votre logo · 3. Choisissez la quantité · 4. Commandez."
        crumbs={[{ label: "Personnaliser" }]}
      />
      <div className="container-ip py-12">
        <h2 className="text-2xl font-bold">Choisissez un article</h2>
        <span className="mt-2 block h-1 w-14 rounded bg-ip-sun" aria-hidden="true" />
        <div className="mt-6">
          {products === null ? (
            <ApiUnavailable />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => {
                const photo = showcaseFor(p);
                return (
                  <li key={p.slug}>
                    <Link
                      href={`/personnaliser/${p.slug}`}
                      className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-ip-line bg-white transition-shadow hover:shadow-lg"
                    >
                      <span className="relative block aspect-[4/3] overflow-hidden bg-white">
                        {photo ? (
                          <Image src={photo.src} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                        ) : (
                          <span className="flex h-full items-center justify-center bg-gradient-to-br from-ip-teal to-ip-teal-deep">
                            <Image src="/brand/icon-ip-192.png" alt="" width={72} height={72} className="size-16 rounded-2xl opacity-95 shadow-lg" />
                          </span>
                        )}
                      </span>
                      <span className="flex flex-1 flex-col p-3 sm:p-4">
                        <span className="font-semibold leading-tight group-hover:text-ip-teal">{p.name}</span>
                        <span className="mt-1 text-xs text-ip-muted">
                          dès {formatHTG(lowestPrice(p.basePrice, p.priceTiers))} / {p.unitLabel}
                        </span>
                        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-bold uppercase tracking-wide text-ip-teal">
                          Personnaliser <ArrowRight className="size-3.5" aria-hidden="true" />
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <h2 id="techniques" className="mt-16 scroll-mt-28 text-2xl font-bold">
          Nos techniques de marquage
        </h2>
        <span className="mt-2 block h-1 w-14 rounded bg-ip-sun" aria-hidden="true" />
        <ul className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => {
            const Icon = icons[s.id];
            return (
              <li key={s.id} id={s.id} className="scroll-mt-32 rounded-[var(--radius-card)] border border-ip-line bg-white p-6">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-ip-teal text-white shadow-offset">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-xl font-semibold">{s.name}</h3>
                <p className="mt-1 text-sm text-ip-muted">{s.description}</p>
              </li>
            );
          })}
        </ul>
        <div className="mt-12 flex flex-col items-start gap-4 rounded-[1.5rem] bg-ip-ink p-8 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Un projet particulier ?</h2>
            <p className="text-white/80">Grandes quantités, article hors catalogue, kit sur mesure : demandez un devis.</p>
          </div>
          <Link href="/devis" className="inline-flex h-12 items-center gap-2 rounded-xl bg-ip-sun px-6 font-bold text-ip-ink hover:bg-ip-sun-600">
            Demander un devis <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </>
  );
}
