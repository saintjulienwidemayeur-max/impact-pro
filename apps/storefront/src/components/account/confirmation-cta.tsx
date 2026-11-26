"use client";

import Link from "next/link";
import { UserPlus, UserRound } from "lucide-react";
import { useAuth } from "../auth-provider";

/** On the order confirmation: guests are invited to create an account (e-mail prefilled, order attached on sign-up). */
export function ConfirmationAccountCta({ reference, email }: { reference: string; email: string }) {
  const { user, status } = useAuth();
  if (status === "loading") return null;
  if (user) {
    return (
      <div className="mt-6 rounded-2xl bg-white/10 p-4 text-sm" data-testid="confirmation-member">
        <p className="font-semibold">Retrouvez cette commande dans votre espace client.</p>
        <Link href={`/compte/commandes/${encodeURIComponent(reference)}`} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-ip-sun px-4 font-bold text-ip-ink hover:bg-ip-sun-600">
          <UserRound className="size-4" aria-hidden="true" /> Voir ma commande
        </Link>
      </div>
    );
  }
  const href = `/inscription?email=${encodeURIComponent(email)}&ref=${encodeURIComponent(reference)}&next=${encodeURIComponent("/compte")}`;
  return (
    <div className="mt-6 rounded-2xl bg-white/10 p-4 text-sm" data-testid="confirmation-guest-cta">
      <p className="font-semibold">Créez un compte pour suivre cette commande et les prochaines.</p>
      <p className="mt-1 text-white/80">Votre commande sera ajoutée automatiquement à votre compte.</p>
      <Link href={href} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-ip-sun px-4 font-bold text-ip-ink hover:bg-ip-sun-600">
        <UserPlus className="size-4" aria-hidden="true" /> Créer un compte
      </Link>
    </div>
  );
}
