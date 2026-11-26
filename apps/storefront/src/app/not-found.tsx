import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-ip flex flex-col items-center py-24 text-center">
      <p className="font-heading text-7xl font-bold text-ip-teal">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page introuvable</h1>
      <p className="mt-2 text-ip-muted">Cette page n&apos;existe pas ou a été déplacée.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="inline-flex h-11 items-center rounded-xl bg-ip-teal px-5 text-sm font-semibold text-white hover:bg-ip-teal-600">
          Retour à l&apos;accueil
        </Link>
        <Link href="/produits" className="inline-flex h-11 items-center rounded-xl border-2 border-ip-teal px-5 text-sm font-semibold text-ip-teal hover:bg-ip-teal hover:text-white">
          Voir les produits
        </Link>
      </div>
    </div>
  );
}
