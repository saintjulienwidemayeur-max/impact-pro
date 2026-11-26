import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Conditions d'utilisation et confidentialité",
  description: "Conditions d'utilisation du compte client Impact Pro et résumé de notre politique de confidentialité.",
  alternates: { canonical: "/conditions" },
};

const sections: { title: string; body: string[] }[] = [
  {
    title: "Votre compte",
    body: [
      "Le compte client vous permet de suivre vos commandes et de retrouver vos informations. Vous restez libre de commander sans compte.",
      "Vous êtes responsable de la confidentialité de votre mot de passe. Choisissez-en un unique et difficile à deviner ; prévenez-nous si vous pensez que votre compte a été utilisé par quelqu'un d'autre.",
    ],
  },
  {
    title: "Données que nous conservons",
    body: [
      "Nom, e-mail, téléphone (facultatif) et historique de vos commandes (articles, logos et fichiers que vous nous envoyez, aperçus).",
      "Votre mot de passe n'est jamais stocké en clair : il est protégé par un hachage Argon2id. Nous ne conservons aucune donnée de carte bancaire sur ce site.",
    ],
  },
  {
    title: "Utilisation de vos données",
    body: [
      "Vos données servent uniquement à traiter vos commandes, vous envoyer les maquettes et assurer le suivi. Nous ne les vendons pas.",
      "Vous pouvez demander la correction ou la suppression de votre compte en nous écrivant.",
    ],
  },
  {
    title: "Contenus que vous nous envoyez",
    body: ["En envoyant un logo, un texte ou un fichier, vous confirmez avoir le droit de l'utiliser et de le faire imprimer."],
  },
];

export default function TermsPage() {
  return (
    <>
      <PageHeader title="Conditions et confidentialité" crumbs={[{ label: "Conditions" }]} />
      <div className="container-ip py-10">
        <div className="mx-auto max-w-3xl space-y-8">
          <p className="rounded-2xl bg-ip-mist p-4 text-sm text-ip-muted">
            Texte de base destiné à être relu et complété par {site.legalName} avant la mise en production.
          </p>
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-xl font-semibold">{s.title}</h2>
              <div className="mt-2 space-y-2 text-sm text-ip-ink/90">
                {s.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </section>
          ))}
          <p className="text-sm">
            Une question ?{" "}
            <Link href="/contact" className="font-semibold text-ip-teal underline-offset-2 hover:underline">
              Contactez-nous
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
