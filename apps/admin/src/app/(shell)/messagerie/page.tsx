"use client";

import { Inbox, MailWarning } from "lucide-react";
import Link from "next/link";
import { Gate } from "@/components/gate";
import { Badge, Card, ErrorState, PageHeader, Skeleton } from "@/components/ui/kit";
import { dateFr } from "@/lib/format";
import { useFetch } from "@/lib/hooks";

interface MailStatus {
  configured: boolean;
  provider?: string | null;
  fromAddress?: string | null;
  lastSyncAt?: string | null;
  unread?: number;
}

export default function MailPage() {
  return (
    <Gate perm="mail.read">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const { data, loading, error, reload } = useFetch<MailStatus>("/admin/mail/status");
  // 404 = the mail module is not deployed yet: same message as "not configured".
  const missing = error?.status === 404;

  return (
    <>
      <PageHeader title="Messagerie" subtitle="Envoyer et recevoir les e-mails des clients sans quitter l'administration." />
      {error && !missing ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data && !error ? (
        <Skeleton className="h-48" />
      ) : data?.configured ? (
        <Card data-testid="mail-configured">
          <div className="flex items-center gap-3">
            <Inbox className="size-8 text-ip-teal" aria-hidden="true" />
            <div>
              <h2 className="font-heading text-lg font-bold">Messagerie connectée</h2>
              <p className="text-sm text-ip-muted">
                Fournisseur : {data.provider ?? "—"} · Expéditeur : {data.fromAddress ?? "—"}
                {data.lastSyncAt ? ` · Dernière synchronisation : ${dateFr(data.lastSyncAt, true)}` : ""}
              </p>
            </div>
            {typeof data.unread === "number" && <Badge tone="sun">{data.unread} non lus</Badge>}
          </div>
          <p className="mt-4 text-sm">
            Les devis et factures sont envoyés par e-mail depuis leur page. La boîte de réception complète arrive avec la prochaine version ; en attendant, ouvrez un document pour l&apos;envoyer à votre client.
          </p>
          <Link href="/factures" className="mt-3 inline-block text-sm font-semibold text-ip-teal underline">
            Aller aux factures
          </Link>
        </Card>
      ) : (
        <Card data-testid="mail-not-configured-page" className="max-w-3xl">
          <div className="flex items-start gap-3">
            <MailWarning className="mt-1 size-8 shrink-0 text-ip-sun" aria-hidden="true" />
            <div>
              <h2 className="font-heading text-xl font-bold">Messagerie non configurée</h2>
              <p className="mt-1 text-sm text-ip-muted">Aucun fournisseur e-mail n&apos;est encore branché. Tant que ce n&apos;est pas fait, l&apos;envoi de documents par e-mail est désactivé : vous pouvez les envoyer vous-même (PDF) puis cliquer « Marquer comme envoyé seulement ».</p>
              <h3 className="mt-5 font-semibold">Mise en place</h3>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
                <li>
                  <strong>Option simple (recommandée sur Render gratuit) :</strong> créez un compte chez un service d&apos;envoi HTTPS (Resend) et vérifiez le domaine d&apos;Impact Pro. Les ports SMTP sont bloqués sur les instances gratuites.
                </li>
                <li>
                  <strong>Option auto-hébergée :</strong> installez le serveur open source Stalwart Mail Server (kit dans <code className="rounded bg-ip-mist px-1">infra/mail/</code>, guide dans <code className="rounded bg-ip-mist px-1">docs/mail-server.md</code>) sur un petit serveur avec une adresse IP dédiée.
                </li>
                <li>
                  Renseignez ensuite les variables d&apos;environnement du service API : <code className="rounded bg-ip-mist px-1">MAIL_PROVIDER</code>, <code className="rounded bg-ip-mist px-1">MAIL_FROM_NAME</code>, <code className="rounded bg-ip-mist px-1">MAIL_FROM_ADDRESS</code> et les identifiants du fournisseur (jamais dans le code).
                </li>
                <li>Redéployez l&apos;API : cette page affichera « Messagerie connectée ».</li>
              </ol>
              <button type="button" onClick={reload} className="mt-5 rounded-xl border-2 border-ip-teal px-3 py-1.5 text-sm font-semibold text-ip-teal hover:bg-ip-teal hover:text-white">
                Vérifier à nouveau
              </button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
