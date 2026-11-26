import type { Metadata } from "next";
import { Clock, Palette, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { QuoteForm } from "@/components/quote-form";

export const metadata: Metadata = {
  title: "Demander un devis",
  description: "Recevez gratuitement un devis personnalisé pour vos articles promotionnels Impact Pro sous 24 h ouvrées.",
  alternates: { canonical: "/devis" },
};

type SearchParams = Promise<{ depuis?: string }>;

export default async function QuotePage({ searchParams }: { searchParams: SearchParams }) {
  const { depuis } = await searchParams;
  return (
    <>
      <PageHeader
        title="Demander un devis"
        intro="Décrivez votre projet : nous revenons vers vous avec une maquette et un prix sous 24 h ouvrées."
        crumbs={[{ label: "Devis" }]}
      />
      <div className="container-ip grid gap-10 py-10 lg:grid-cols-[1fr_300px]">
        <div className="rounded-[1.5rem] border border-ip-line bg-white p-5 sm:p-8">
          <QuoteForm fromCart={depuis === "panier"} />
        </div>
        <aside className="space-y-4">
          {[
            { icon: Clock, title: "Réponse sous 24 h", text: "Un conseiller étudie votre demande rapidement." },
            { icon: Palette, title: "Maquette gratuite", text: "Visualisez votre logo avant production." },
            { icon: ShieldCheck, title: "Sans engagement", text: "Le devis est gratuit et sans obligation." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3 rounded-2xl bg-ip-mist p-4">
              <Icon className="size-6 shrink-0 text-ip-teal" aria-hidden="true" />
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-ip-muted">{text}</p>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
