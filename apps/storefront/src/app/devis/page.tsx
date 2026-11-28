import type { Metadata } from "next";
import { Clock, Palette, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { QuoteForm } from "@/components/quote-form";
import { projectSizes, quoteServices, type ProjectSize, type ServiceId } from "@/config/offer";

export const metadata: Metadata = {
  title: "Demander une proforma",
  description: "Articles promotionnels, sourcing de produits, événements ou conseil : recevez gratuitement une proforma Impact Pro sous 24 h ouvrées.",
  alternates: { canonical: "/devis" },
};

type SearchParams = Promise<{ depuis?: string; service?: string; taille?: string }>;

export default async function QuotePage({ searchParams }: { searchParams: SearchParams }) {
  const { depuis, service, taille } = await searchParams;
  const defaultService = quoteServices.some((s) => s.id === service) ? (service as ServiceId) : undefined;
  const defaultSize = projectSizes.some((s) => s.id === taille) ? (taille as ProjectSize) : undefined;
  return (
    <>
      <PageHeader
        title="Demander une proforma"
        intro="Articles promotionnels, sourcing, événement ou conseil : décrivez votre projet, nous revenons vers vous avec une proforma sous 24 h ouvrées."
        crumbs={[{ label: "Proforma" }]}
      />
      <div className="container-ip grid gap-10 py-10 lg:grid-cols-[1fr_300px]">
        <div className="rounded-[1.5rem] border border-ip-line bg-white p-5 sm:p-8">
          <QuoteForm fromCart={depuis === "panier"} defaultService={defaultService} defaultSize={defaultSize} />
        </div>
        <aside className="space-y-4">
          {[
            { icon: Clock, title: "Réponse sous 24 h", text: "Un conseiller étudie votre demande rapidement." },
            { icon: Palette, title: "Maquette gratuite", text: "Pour les articles : votre logo visualisé avant production." },
            { icon: ShieldCheck, title: "Sans engagement", text: "La proforma est gratuite et sans obligation." },
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
