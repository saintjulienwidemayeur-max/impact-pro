import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Paintbrush, Search } from "lucide-react";
import { CategoryStage } from "@/components/category-stage";
import { GhostLink, PrimaryLink, ServiceHero } from "@/components/service-hero";
import { promoCategories, quoteHref } from "@/config/offer";
import { categoryIcons } from "@/config/offer-icons";

export const metadata: Metadata = {
  title: "Articles promotionnels",
  description: "Giveaways, cadeaux corporate et articles pour événements de masse (carnaval, festivals) personnalisés à votre logo. Proforma sous 24 h.",
  alternates: { canonical: "/articles-promotionnels" },
};

export default function PromoItemsPage() {
  return (
    <>
      <ServiceHero
        eyebrow="Notre cœur de métier"
        title="Articles promotionnels"
        intro="Giveaways, cadeaux corporate et articles pour grands événements : choisissez une catégorie, personnalisez en ligne ou décrivez votre besoin, nous vous envoyons une proforma."
        crumbs={[{ label: "Articles promotionnels" }]}
      >
        <PrimaryLink href={quoteHref("articles")}>
          Demander une proforma <ArrowRight className="size-[18px]" aria-hidden="true" />
        </PrimaryLink>
        <GhostLink href="/personnaliser">
          <Paintbrush className="size-[18px]" aria-hidden="true" /> Personnaliser en ligne
        </GhostLink>
      </ServiceHero>

      <div className="container-ip space-y-6 py-14 lg:py-20">
        {promoCategories.map((c, i) => {
          const Icon = categoryIcons[c.slug];
          return (
            <article
              key={c.slug}
              id={c.slug}
              className="grid scroll-mt-28 overflow-hidden rounded-3xl border border-ip-line bg-white lg:grid-cols-2"
              aria-labelledby={`cat-${c.slug}`}
            >
              <div className={`relative min-h-64 sm:min-h-80 ${i % 2 ? "lg:order-2" : ""}`}>
                <CategoryStage slug={c.slug} />
                {c.slug === "evenements-de-masse" && (
                  <span className="absolute bottom-3.5 left-3.5 z-10 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold">Visuel provisoire · photos à venir</span>
                )}
              </div>
              <div className="flex flex-col p-7 sm:p-10">
                <span className="inline-flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.12em] text-ip-teal">
                  <Icon className="size-4" aria-hidden="true" /> {c.kicker}
                </span>
                <h2 id={`cat-${c.slug}`} className="mt-2 text-[32px] font-semibold leading-tight sm:text-[38px]">
                  {c.name}
                </h2>
                <p className="mt-3 text-ip-muted">{c.description}</p>
                <ul className="mt-5 grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
                  {c.groups.map((g) => (
                    <li key={g} className="flex items-center gap-2 text-[14.5px] font-semibold">
                      <Check className="size-4 shrink-0 text-ip-teal" strokeWidth={2.6} aria-hidden="true" /> {g}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href={`/articles-promotionnels/${c.slug}`} className="inline-flex h-12 items-center gap-2 rounded-xl bg-ip-teal px-5 font-bold text-white hover:bg-ip-teal-600">
                    Voir la catégorie <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                  <Link href={quoteHref("articles")} className="inline-flex h-12 items-center rounded-xl border-[1.5px] border-ip-line px-5 font-bold hover:border-ip-teal hover:text-ip-teal">
                    Demander une proforma
                  </Link>
                </div>
              </div>
            </article>
          );
        })}

        <div className="flex flex-col gap-5 rounded-3xl bg-ip-deep p-7 text-white sm:flex-row sm:items-center sm:p-9">
          <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl bg-ip-cyan/15 text-ip-cyan">
            <Search className="size-7" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold">Vous ne trouvez pas votre article ?</h2>
            <p className="mt-1 text-white/75">Notre service d&apos;achat et de sourcing le trouve pour vous, en petite ou grande quantité.</p>
          </div>
          <Link href="/sourcing" className="inline-flex h-12 items-center gap-2 self-start rounded-xl bg-ip-sun px-5 font-bold text-ip-ink hover:bg-ip-sun-600 sm:self-auto">
            Lancer une recherche <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </>
  );
}
