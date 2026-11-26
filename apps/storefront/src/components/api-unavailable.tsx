import Link from "next/link";
import { CloudOff } from "lucide-react";
import { whatsappHref } from "@/lib/site";

/** Error state shown when the catalog API cannot be reached (never replaced by fake data). */
export function ApiUnavailable({ title = "Catalogue momentanément indisponible", compact = false }: { title?: string; compact?: boolean }) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-ip-line bg-ip-mist px-6 text-center ${compact ? "py-8" : "py-14"}`}
    >
      <CloudOff className="size-10 text-ip-teal" aria-hidden="true" />
      <h2 className="mt-3 text-xl font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-ip-muted">
        Nous n&apos;arrivons pas à charger nos produits pour le moment. Réessayez dans quelques instants, ou écrivez-nous : nous vous répondons rapidement.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <a href="" className="inline-flex h-11 items-center rounded-xl border-2 border-ip-teal px-5 text-sm font-semibold text-ip-teal hover:bg-ip-teal hover:text-white">
          Réessayer
        </a>
        <Link href={whatsappHref()} className="inline-flex h-11 items-center rounded-xl bg-ip-sun px-5 text-sm font-semibold text-ip-ink hover:bg-ip-sun-600">
          Nous contacter
        </Link>
      </div>
    </div>
  );
}
