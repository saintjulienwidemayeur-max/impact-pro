import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { ApiUnavailable } from "@/components/api-unavailable";
import { OrderDetails } from "@/components/order-details";
import { PageHeader } from "@/components/page-header";
import { getCustomOrder, optionLabelsBySlug, type CustomOrder } from "@/lib/api";
import { fieldErrors, trackingSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Suivi de commande",
  description: "Suivez l'avancement de votre commande Impact Pro avec votre référence et votre adresse courriel.",
  alternates: { canonical: "/suivi" },
};

type SearchParams = Promise<{ ref?: string | string[]; email?: string | string[] }>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function TrackingPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const ref = first(sp.ref).slice(0, 40);
  const email = first(sp.email).slice(0, 254);
  const submitted = Boolean(ref || email);
  const parsed = trackingSchema.safeParse({ ref, email });
  const errors = submitted && !parsed.success ? fieldErrors(parsed.error) : {};

  let order: CustomOrder | null = null;
  let failed = false;
  if (submitted && parsed.success) {
    try {
      order = await getCustomOrder(parsed.data.ref.toUpperCase(), parsed.data.email);
    } catch {
      failed = true;
    }
  }

  const input =
    "h-11 w-full rounded-xl border border-ip-line bg-white px-4 text-sm focus:border-ip-teal focus:outline-none focus:ring-2 focus:ring-ip-cyan/50 aria-[invalid=true]:border-red-600";

  const labels = order ? await optionLabelsBySlug() : {};

  return (
    <>
      <PageHeader title="Suivi de commande" intro="Entrez votre référence (ex. IP-2026-000123) et le courriel utilisé lors de la commande." crumbs={[{ label: "Suivi" }]} />
      <div className="container-ip space-y-8 py-10">
        <form method="get" action="/suivi" className="grid gap-4 rounded-2xl border border-ip-line p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-start" noValidate>
          <div>
            <label htmlFor="ref" className="mb-1.5 block text-sm font-medium">
              Référence
            </label>
            <input id="ref" name="ref" defaultValue={ref} placeholder="IP-2026-000123" className={input} aria-invalid={Boolean(errors.ref)} aria-describedby="ref-msg" required />
            <p id="ref-msg" className="mt-1 min-h-4 text-xs text-red-700">{errors.ref ?? ""}</p>
          </div>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Courriel
            </label>
            <input id="email" name="email" type="email" defaultValue={email} className={input} aria-invalid={Boolean(errors.email)} aria-describedby="email-msg" required />
            <p id="email-msg" className="mt-1 min-h-4 text-xs text-red-700">{errors.email ?? ""}</p>
          </div>
          <button type="submit" className="h-11 rounded-xl bg-ip-teal px-6 text-sm font-semibold text-white hover:bg-ip-teal-600 sm:mt-7">
            Rechercher
          </button>
        </form>

        {failed && <ApiUnavailable title="Suivi momentanément indisponible" compact />}
        {order && <OrderDetails order={order} labels={labels} />}
        {submitted && parsed.success && !failed && !order && (
          <div role="status" className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-ip-line bg-ip-mist px-6 py-10 text-center">
            <SearchX className="size-10 text-ip-teal" aria-hidden="true" />
            <h2 className="mt-3 text-xl font-semibold">Aucune commande trouvée</h2>
            <p className="mt-1 max-w-md text-sm text-ip-muted">Vérifiez la référence et l&apos;adresse courriel utilisées lors de la commande.</p>
          </div>
        )}
      </div>
    </>
  );
}
