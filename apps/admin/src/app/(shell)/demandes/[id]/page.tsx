"use client";

import { ArrowLeft, Download, FilePlus2, Loader2, Mail, Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Gate } from "@/components/gate";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Badge, Card, ErrorState, PageHeader, Skeleton } from "@/components/ui/kit";
import { ApiError, patch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateFr, PROJECT_SIZE, QUOTE_REQUEST_STATUS, QUOTE_SERVICE } from "@/lib/format";
import { useFetch } from "@/lib/hooks";
import { QUOTE_REQUEST_STATUSES, type QuoteRequest, type QuoteRequestStatus } from "@/lib/types";

export default function QuoteRequestPage() {
  return (
    <Gate perm="quotes.read">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { data: r, error, reload } = useFetch<QuoteRequest>(`/admin/quote-requests/${id}`);
  const [status, setStatus] = React.useState<QuoteRequestStatus>("NEW");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!r) return;
    setStatus(r.status);
    setNote(r.internalNote ?? "");
  }, [r]);

  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!r) return <Skeleton className="h-96" />;

  const writable = can("quotes.write");
  const dirty = status !== r.status || note !== (r.internalNote ?? "");

  async function save() {
    setBusy(true);
    try {
      await patch(`/admin/quote-requests/${id}`, { status, internalNote: note });
      toast.success("Demande mise à jour.");
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Échec de l'enregistrement.");
    } finally {
      setBusy(false);
    }
  }

  const proformaHref = `/documents/new?type=PROFORMA&fromRequest=${r.id}${r.customerId ? `&customerId=${r.customerId}` : ""}`;

  return (
    <>
      <Link href="/demandes" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ip-teal hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Toutes les demandes
      </Link>
      <PageHeader
        title={`Demande ${r.reference}`}
        subtitle={`${QUOTE_SERVICE[r.service]} · reçue le ${dateFr(r.createdAt)}`}
        actions={
          writable && (
            <Link href={proformaHref} data-testid="request-proforma" className="inline-flex h-10 items-center gap-2 rounded-xl bg-ip-sun px-4 text-sm font-bold text-ip-ink hover:bg-ip-sun-600">
              <FilePlus2 className="size-4" aria-hidden="true" /> Préparer la proforma
            </Link>
          )
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={QUOTE_REQUEST_STATUS[r.status].tone}>{QUOTE_REQUEST_STATUS[r.status].label}</Badge>
              <Badge tone="gray">{QUOTE_SERVICE[r.service]}</Badge>
              {r.size && <Badge tone="gray">{PROJECT_SIZE[r.size]}</Badge>}
              {r.quantity && <Badge tone="gray">{r.quantity.toLocaleString("fr-FR")} pièces</Badge>}
            </div>
            <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-ip-muted">Projet</h2>
            <p className="mt-1 whitespace-pre-line" data-testid="request-project">
              {r.project}
            </p>
            {r.message && (
              <>
                <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-ip-muted">Précisions</h2>
                <p className="mt-1 whitespace-pre-line">{r.message}</p>
              </>
            )}
            {r.logo && (
              <>
                <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-ip-muted">Logo joint</h2>
                <div className="mt-2 flex items-center gap-3">
                  {r.logo.mimeType.startsWith("image/") && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.logo.url} alt={`Logo ${r.logo.originalName}`} className="size-20 rounded-lg border border-ip-line bg-white object-contain p-1" />
                  )}
                  <a href={r.logo.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-ip-teal hover:underline">
                    <Download className="size-4" aria-hidden="true" /> {r.logo.originalName}
                  </a>
                </div>
              </>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Suivi</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-[220px_1fr]">
              <Field id="req-status" label="Statut">
                <Select id="req-status" value={status} onChange={(e) => setStatus(e.target.value as QuoteRequestStatus)} disabled={!writable} data-testid="request-status">
                  {QUOTE_REQUEST_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {QUOTE_REQUEST_STATUS[s].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="req-note" label="Note interne" hint="Visible uniquement par l'équipe.">
                <Textarea id="req-note" value={note} onChange={(e) => setNote(e.target.value)} disabled={!writable} maxLength={4000} className="min-h-24" aria-describedby="req-note-msg" data-testid="request-note" />
              </Field>
            </div>
            {writable && (
              <div className="mt-4 flex justify-end">
                <Button onClick={save} disabled={!dirty || busy} data-testid="request-save">
                  {busy && <Loader2 className="animate-spin" aria-hidden="true" />} Enregistrer
                </Button>
              </div>
            )}
          </Card>
        </div>
        <Card className="h-fit p-5">
          <h2 className="font-semibold">Client</h2>
          <p className="mt-3 flex items-center gap-2 font-medium">
            <UserRound className="size-4 text-ip-teal" aria-hidden="true" /> {r.fullName}
          </p>
          {r.company && <p className="ml-6 text-sm text-ip-muted">{r.company}</p>}
          <p className="mt-2 flex items-center gap-2 text-sm">
            <Mail className="size-4 text-ip-teal" aria-hidden="true" />
            <a href={`mailto:${r.email}?subject=${encodeURIComponent(`Votre demande ${r.reference}`)}`} className="hover:underline">
              {r.email}
            </a>
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm">
            <Phone className="size-4 text-ip-teal" aria-hidden="true" />
            <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="hover:underline">
              {r.phone}
            </a>
          </p>
          {r.customerId && can("customers.read") && (
            <Link href={`/clients/${r.customerId}`} className="mt-4 inline-flex text-sm font-semibold text-ip-teal hover:underline">
              Fiche client →
            </Link>
          )}
        </Card>
      </div>
    </>
  );
}
