import type { Metadata } from "next";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Espace client", robots: { index: false } };

export default function AccountPage() {
  return (
    <>
      <PageHeader title="Espace client" crumbs={[{ label: "Espace client" }]} />
      <div className="container-ip py-12">
        <div className="mx-auto flex max-w-xl flex-col items-center rounded-[var(--radius-card)] border border-ip-line bg-ip-mist px-6 py-14 text-center">
          <UserRound className="size-12 text-ip-teal" aria-hidden="true" />
          <h2 className="mt-4 text-2xl font-semibold">Votre espace client arrive bientôt</h2>
          <p className="mt-2 text-sm text-ip-muted">
            Vous pourrez bientôt suivre vos commandes, votre production et vos livraisons en ligne. En attendant, notre équipe suit chaque
            commande avec vous.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/contact" className="inline-flex h-11 items-center rounded-xl bg-ip-teal px-5 text-sm font-semibold text-white hover:bg-ip-teal-600">
              Nous contacter
            </Link>
            <Link href="/devis" className="inline-flex h-11 items-center rounded-xl bg-ip-sun px-5 text-sm font-semibold text-ip-ink hover:bg-ip-sun-600">
              Demander un devis
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
