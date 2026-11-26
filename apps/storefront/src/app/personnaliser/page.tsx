import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Brush, Layers, Printer, Scissors, Sparkles, Stamp, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { services } from "@/lib/site";

export const metadata: Metadata = {
  title: "Personnaliser · Nos services",
  description: "Sérigraphie, broderie, sublimation, tampographie, grand format et création graphique : découvrez nos techniques de personnalisation.",
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

const productsFor: Record<(typeof services)[number]["id"], string> = {
  serigraphie: "t-shirts-polos",
  broderie: "casquettes",
  sublimation: "tasses",
  tampographie: "carnets-stylos",
  "grand-format": "banderoles",
  design: "cartes-de-visite",
};

export default function CustomizePage() {
  return (
    <>
      <PageHeader
        title="Personnalisez vos articles"
        intro="Le bon procédé pour chaque support, et une maquette gratuite avant production."
        crumbs={[{ label: "Personnaliser" }]}
      />
      <div className="container-ip py-12">
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => {
            const Icon = icons[s.id];
            return (
              <li key={s.id} id={s.id} className="scroll-mt-32 rounded-[var(--radius-card)] border border-ip-line bg-white p-6">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-ip-teal text-white shadow-offset">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-xl font-semibold">{s.name}</h2>
                <p className="mt-1 text-sm text-ip-muted">{s.description}</p>
                <Link href={`/produits?categorie=${productsFor[s.id]}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-ip-teal hover:underline">
                  Voir des produits <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-12 flex flex-col items-start gap-4 rounded-[1.5rem] bg-ip-ink p-8 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Vous avez votre logo ? On s&apos;occupe du reste.</h2>
            <p className="text-white/80">Envoyez-le avec votre demande, nous préparons la maquette gratuitement.</p>
          </div>
          <Link href="/devis" className="inline-flex h-12 items-center gap-2 rounded-xl bg-ip-sun px-6 font-bold text-ip-ink hover:bg-ip-sun-600">
            Demander un devis <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </>
  );
}
