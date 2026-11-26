import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "À propos",
  description: "Impact Pro LLC : votre partenaire en articles promotionnels personnalisés en Haïti. Votre marque, partout.",
  alternates: { canonical: "/a-propos" },
};

const values = [
  { title: "Qualité", text: "Des matériaux choisis et un contrôle qualité sur chaque commande." },
  { title: "Proximité", text: "Un conseiller dédié, joignable par téléphone, courriel ou WhatsApp." },
  { title: "Fiabilité", text: "Des délais tenus, de la maquette à la livraison." },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader title="À propos d'Impact Pro" intro={site.tagline} crumbs={[{ label: "À propos" }]} />
      <div className="container-ip grid items-center gap-10 py-12 lg:grid-cols-2">
        <div className="space-y-4 text-ip-ink/90">
          <h2 className="text-3xl font-bold text-ip-teal">Nous mettons votre marque sur tout.</h2>
          <p>
            {site.legalName} aide les entreprises, institutions, associations et organisateurs d&apos;événements à rendre leur marque
            visible : tasses, t-shirts et polos, casquettes, banderoles, drapeaux plume, cartes de visite, carnets, stylos et photocalls.
          </p>
          <p>
            De la création graphique à la livraison, nous gérons chaque étape : choix des articles, maquette, production en sérigraphie,
            broderie, sublimation ou grand format, contrôle qualité et expédition.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/produits" className="inline-flex h-11 items-center rounded-xl bg-ip-teal px-5 text-sm font-semibold text-white hover:bg-ip-teal-600">
              Découvrir nos produits
            </Link>
            <Link href="/devis" className="inline-flex h-11 items-center rounded-xl bg-ip-sun px-5 text-sm font-semibold text-ip-ink hover:bg-ip-sun-600">
              Demander un devis
            </Link>
          </div>
        </div>
        <div className="flex aspect-[4/3] items-center justify-center rounded-[1.5rem] bg-ip-mist p-10">
          <Image src="/brand/logo-impact-pro.png" alt="Logo Impact Pro" width={1600} height={498} className="h-auto w-full max-w-md" />
        </div>
      </div>
      <section aria-labelledby="values-title" className="bg-ip-mist py-12">
        <div className="container-ip">
          <h2 id="values-title" className="text-2xl font-bold">
            Nos valeurs
          </h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {values.map((v) => (
              <li key={v.title} className="rounded-[var(--radius-card)] border border-ip-line bg-white p-6">
                <h3 className="text-lg font-semibold text-ip-teal">{v.title}</h3>
                <p className="mt-1 text-sm text-ip-muted">{v.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
