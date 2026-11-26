import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Mail, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { site, whatsappHref } from "@/lib/site";

export const metadata: Metadata = { title: "Mot de passe oublié", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <PageHeader title="Mot de passe oublié" crumbs={[{ label: "Connexion", href: "/connexion" }, { label: "Mot de passe oublié" }]} />
      <div className="container-ip py-10">
        <div className="mx-auto max-w-xl rounded-[var(--radius-card)] border border-ip-line bg-white p-6 sm:p-8">
          <KeyRound className="size-10 text-ip-teal" aria-hidden="true" />
          <h2 className="mt-3 text-2xl font-bold">Nous vous aidons à retrouver l&apos;accès</h2>
          <p className="mt-2 text-sm text-ip-muted">
            La réinitialisation automatique par e-mail n&apos;est pas encore disponible. Pour des raisons de sécurité, notre équipe vérifie votre identité puis vous
            aide à choisir un nouveau mot de passe.
          </p>
          <ol className="mt-5 space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ip-sun font-bold text-ip-ink">1</span>
              <span className="pt-1">Écrivez-nous depuis l&apos;e-mail de votre compte, avec votre nom complet et, si possible, une référence de commande.</span>
            </li>
            <li className="flex gap-3">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ip-sun font-bold text-ip-ink">2</span>
              <span className="pt-1">Nous confirmons votre identité, puis nous réinitialisons votre accès.</span>
            </li>
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/contact" className="inline-flex h-11 items-center gap-2 rounded-xl bg-ip-teal px-5 text-sm font-semibold text-white hover:bg-ip-teal-600">
              <Mail className="size-4" aria-hidden="true" /> Nous écrire
            </Link>
            <a
              href={whatsappHref("Bonjour Impact Pro, j'ai oublié le mot de passe de mon compte.")}
              className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-ip-teal px-5 text-sm font-semibold text-ip-teal hover:bg-ip-teal hover:text-white"
            >
              <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp
            </a>
          </div>
          <p className="mt-6 text-xs text-ip-muted">
            {site.email} · {site.phoneDisplay}
          </p>
          <p className="mt-4 text-sm">
            <Link href="/connexion" className="font-semibold text-ip-teal underline-offset-2 hover:underline">
              ← Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
