import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Boxes, Building2, PackageSearch, Store, Truck } from "lucide-react";
import { GhostLink, PrimaryLink, ServiceHero } from "@/components/service-hero";
import { quoteHref, sourcingSteps } from "@/config/offer";

export const metadata: Metadata = {
  title: "Achats & sourcing de produits",
  description: "Impact Pro trouve, achète, contrôle et livre les produits dont vous avez besoin, en petite ou grande quantité, de Miami vers Haïti.",
  alternates: { canonical: "/sourcing" },
};

const reasons = [
  { icon: PackageSearch, title: "Le bon produit", text: "Vous décrivez ce qu'il vous faut, nous comparons les fournisseurs et vous proposons les meilleures options." },
  { icon: BadgeCheck, title: "Contrôlé avant l'envoi", text: "La marchandise est vérifiée avant l'expédition : quantité, état, conformité à votre demande." },
  { icon: Truck, title: "Livré jusqu'à vous", text: "Nous gérons l'acheminement de Miami vers Haïti et vous tenons informé." },
  { icon: Boxes, title: "Personnalisable", text: "Le produit peut être marqué à votre logo avant la livraison, comme nos articles promotionnels." },
];

export default function SourcingPage() {
  return (
    <>
      <ServiceHero
        eyebrow="Achats & sourcing"
        title="Le produit qu'il vous faut, trouvé et livré"
        intro="Vous cherchez un produit précis, en petite ou grande quantité ? Nous le cherchons, l'achetons, le contrôlons et vous le livrons. Un seul interlocuteur, une proforma claire."
        crumbs={[{ label: "Sourcing & achats" }]}
      >
        <PrimaryLink href={quoteHref("sourcing")}>
          Lancer une recherche <ArrowRight className="size-[18px]" aria-hidden="true" />
        </PrimaryLink>
        <GhostLink href="/contact">Poser une question</GhostLink>
      </ServiceHero>

      <section aria-labelledby="how-title" className="container-ip py-14 lg:py-20">
        <h2 id="how-title" className="text-3xl font-semibold sm:text-4xl">
          Comment ça marche
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sourcingSteps.map((s, i) => (
            <li key={s.title} className="rounded-3xl border border-ip-line bg-white p-6">
              <span
                className={`inline-flex size-11 items-center justify-center rounded-full font-heading text-lg font-semibold ${
                  i === sourcingSteps.length - 1 ? "bg-ip-sun text-ip-ink" : "bg-ip-teal text-white"
                }`}
              >
                {i + 1}
              </span>
              <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
              <p className="mt-1 text-[14.5px] text-ip-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="why-title" className="bg-ip-mist py-14 lg:py-20">
        <div className="container-ip">
          <h2 id="why-title" className="text-3xl font-semibold sm:text-4xl">
            Pourquoi passer par Impact Pro
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {reasons.map((r) => (
              <li key={r.title} className="flex gap-4 rounded-3xl bg-white p-6">
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-ip-mist text-ip-teal">
                  <r.icon className="size-6" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-heading text-xl font-semibold">{r.title}</span>
                  <span className="mt-1 block text-[14.5px] text-ip-muted">{r.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="who-title" className="container-ip py-14 lg:py-20">
        <h2 id="who-title" className="sr-only">
          Pour qui
        </h2>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl bg-ip-deep p-8 text-white">
            <Building2 className="size-8 text-ip-sun" aria-hidden="true" />
            <h3 className="mt-4 text-2xl font-semibold">Entreprises &amp; gros volumes</h3>
            <p className="mt-2 text-white/75">Équipement, fournitures, matériel d&apos;événement : nous gérons vos achats récurrents ou ponctuels.</p>
          </div>
          <div className="rounded-3xl bg-[#EAF7FC] p-8">
            <Store className="size-8 text-ip-teal" aria-hidden="true" />
            <h3 className="mt-4 text-2xl font-semibold">Petites entreprises &amp; particuliers</h3>
            <p className="mt-2 text-[#3E5B58]">Un seul article ou quelques pièces : décrivez votre besoin, nous vous répondons avec une proforma.</p>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start gap-4 rounded-3xl border border-ip-line p-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-lg font-semibold">Dites-nous ce que vous cherchez : réponse sous 24 h ouvrées.</p>
          <Link href={quoteHref("sourcing")} className="inline-flex h-12 items-center gap-2 rounded-xl bg-ip-teal px-5 font-bold text-white hover:bg-ip-teal-600">
            Lancer une recherche <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
