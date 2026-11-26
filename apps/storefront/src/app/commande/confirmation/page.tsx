import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, SearchX } from "lucide-react";
import { ApiUnavailable } from "@/components/api-unavailable";
import { nextSteps, OrderDetails } from "@/components/order-details";
import { PageHeader } from "@/components/page-header";
import { getCustomOrder, type CustomOrder } from "@/lib/api";
import { trackingSchema } from "@/lib/schemas";
import { whatsappHref } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Commande confirmée", robots: { index: false } };

type SearchParams = Promise<{ ref?: string | string[]; email?: string | string[] }>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ConfirmationPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const parsed = trackingSchema.safeParse({ ref: first(sp.ref), email: first(sp.email) });

  let order: CustomOrder | null = null;
  let failed = false;
  if (parsed.success) {
    try {
      order = await getCustomOrder(parsed.data.ref.toUpperCase(), parsed.data.email);
    } catch {
      failed = true;
    }
  }

  return (
    <>
      <PageHeader title="Merci pour votre commande !" crumbs={[{ label: "Commande" }, { label: "Confirmation" }]} />
      <div className="container-ip grid gap-8 py-10 lg:grid-cols-[1fr_340px]">
        <div>
          {failed ? (
            <ApiUnavailable title="Commande enregistrée, détail momentanément indisponible" compact />
          ) : order ? (
            <>
              <div className="mb-6 flex items-start gap-3 rounded-2xl bg-ip-teal/10 p-4 text-ip-ink">
                <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-ip-teal" aria-hidden="true" />
                <p className="text-sm">
                  Votre commande est bien reçue. Notre équipe vous contacte à <strong>{first(sp.email)}</strong> avec votre maquette. Conservez
                  votre référence pour suivre l&apos;avancement.
                </p>
              </div>
              <OrderDetails order={order} />
            </>
          ) : (
            <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-ip-line bg-ip-mist px-6 py-14 text-center">
              <SearchX className="size-10 text-ip-teal" aria-hidden="true" />
              <h2 className="mt-3 text-xl font-semibold">Commande introuvable</h2>
              <p className="mt-1 max-w-md text-sm text-ip-muted">Vérifiez la référence et l&apos;adresse courriel, ou retrouvez votre commande depuis la page de suivi.</p>
              <Link href="/suivi" className="mt-5 inline-flex h-11 items-center rounded-xl bg-ip-sun px-5 text-sm font-semibold text-ip-ink hover:bg-ip-sun-600">
                Suivre une commande
              </Link>
            </div>
          )}
        </div>
        <aside className="h-fit rounded-2xl bg-ip-ink p-6 text-white">
          <h2 className="text-lg font-semibold">Et maintenant ?</h2>
          <ol className="mt-4 space-y-3">
            {nextSteps.map((s, i) => (
              <li key={s} className="flex items-start gap-3 text-sm">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ip-sun font-bold text-ip-ink">{i + 1}</span>
                <span className="pt-1">{s}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/suivi" className="inline-flex h-11 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold hover:bg-white/20">
              Suivre ma commande
            </Link>
            <Link href={whatsappHref("Bonjour Impact Pro, je vous écris au sujet de ma commande.")} className="inline-flex h-11 items-center justify-center rounded-xl bg-ip-sun text-sm font-semibold text-ip-ink hover:bg-ip-sun-600">
              Nous écrire
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
