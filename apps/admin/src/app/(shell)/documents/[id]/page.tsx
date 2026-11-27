"use client";

import { ArrowLeft, Ban, Check, Copy, CreditCard, Download, FileOutput, Link2, Loader2, Mail, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { DocStatusBadge } from "@/components/badges";
import { Gate } from "@/components/gate";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge, Card, ConfirmDialog, CopyButton, Dialog, ErrorState, PageHeader, Skeleton } from "@/components/ui/kit";
import { ApiError, del, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DOC_TYPE, dateFr, methodLabel, money, PAYMENT_METHODS, today } from "@/lib/format";
import { useFetch } from "@/lib/hooks";
import { documentReadPerm, documentWritePerm } from "@/lib/permissions";
import type { BillingDocument, DocumentType, PaymentMethod } from "@/lib/types";

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useFetch<BillingDocument>(`/admin/documents/${id}`);
  if (error) return <ErrorState message={error.status === 404 ? "Document introuvable." : error.message} onRetry={reload} />;
  if (loading && !data) return <Skeleton className="h-96" />;
  if (!data) return null;
  return (
    <Gate perm={documentReadPerm(data.type)}>
      <Inner doc={data} reload={reload} />
    </Gate>
  );
}

type Dlg = null | "send" | "payment" | "void" | "convert" | "delete" | "accept" | "reject" | "voidPayment";

function Inner({ doc, reload }: { doc: BillingDocument; reload: () => void }) {
  const router = useRouter();
  const { can } = useAuth();
  const writePerm = documentWritePerm(doc.type);
  const canWrite = can(writePerm);
  const [dlg, setDlg] = React.useState<Dlg>(null);
  const [busy, setBusy] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [convertTo, setConvertTo] = React.useState<"PROFORMA" | "INVOICE">(doc.type === "QUOTE" ? "PROFORMA" : "INVOICE");
  const [voidPaymentId, setVoidPaymentId] = React.useState<string | null>(null);
  const isDraft = doc.status === "DRAFT";
  const isInvoice = doc.type === "INVOICE";
  const canPay = isInvoice && can("payments.write") && ["SENT", "PARTIALLY_PAID"].includes(doc.status) && Number(doc.balance) > 0;
  const canConvert = canWrite && doc.status !== "VOID" && doc.type !== "INVOICE" && !isDraft;
  const canVoid = canWrite && doc.status !== "VOID" && !(isInvoice && doc.status === "PAID" && false);
  const publicLink = doc.publicToken ? `${typeof window !== "undefined" ? "" : ""}${doc.publicUrl ?? `/api/v1/public/documents/${doc.publicToken}/pdf`}` : null;

  async function run<T>(fn: () => Promise<T>, ok: string, after?: (r: T) => void) {
    setBusy(true);
    try {
      const r = await fn();
      toast.success(ok);
      setDlg(null);
      setReason("");
      if (after) after(r);
      else reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link href={DOC_TYPE[doc.type].path} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ip-teal hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> {DOC_TYPE[doc.type].plural}
      </Link>
      <PageHeader
        title={doc.number}
        subtitle={`${DOC_TYPE[doc.type].label} · ${doc.customer.name}${doc.customer.company ? ` (${doc.customer.company})` : ""}`}
        actions={
          <>
            <span data-testid="doc-status">
              <DocStatusBadge status={doc.status} overdue={doc.isOverdue} />
            </span>
            {canWrite && isDraft && (
              <Link href={`/documents/${doc.id}/edit`} data-testid="doc-edit" className="inline-flex h-9 items-center gap-2 rounded-xl border-2 border-ip-teal px-3 text-sm font-semibold text-ip-teal hover:bg-ip-teal hover:text-white">
                <Pencil className="size-4" aria-hidden="true" /> Modifier
              </Link>
            )}
            {canWrite && !isDraft && !isInvoice && doc.status !== "VOID" && (
              <Link href={`/documents/${doc.id}/edit`} className="inline-flex h-9 items-center gap-2 rounded-xl border-2 border-ip-teal px-3 text-sm font-semibold text-ip-teal hover:bg-ip-teal hover:text-white">
                <Pencil className="size-4" aria-hidden="true" /> Notes / échéance
              </Link>
            )}
            {canWrite && doc.status !== "VOID" && (
              <Button variant="sun" size="sm" onClick={() => setDlg("send")} data-testid="doc-send">
                <Mail /> {isDraft ? "Envoyer" : "Renvoyer"}
              </Button>
            )}
            <a href={`/api/v1/admin/documents/${doc.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl border-2 border-ip-teal px-3 text-sm font-semibold text-ip-teal hover:bg-ip-teal hover:text-white" data-testid="doc-pdf-link">
              <Download className="size-4" aria-hidden="true" /> PDF
            </a>
          </>
        }
      />

      {doc.status === "VOID" && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">Ce document est annulé.</p>}

      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Card className="p-0">
            <div className="border-b border-ip-line px-4 py-2.5 text-sm font-semibold">Aperçu du PDF</div>
            <iframe title={`PDF ${doc.number}`} src={`/api/v1/admin/documents/${doc.id}/pdf#toolbar=0`} className="h-[34rem] w-full rounded-b-2xl bg-ip-mist" data-testid="pdf-frame" />
          </Card>

          <Card>
            <h2 className="mb-3 font-heading text-lg font-bold">Lignes</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm" data-testid="doc-lines">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ip-muted">
                    <th className="pb-2">Description</th>
                    <th className="pb-2 text-right">Qté</th>
                    <th className="pb-2 text-right">Prix unit.</th>
                    <th className="pb-2 text-right">Remise</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.lines.map((l) => (
                    <tr key={l.id ?? l.position} className="border-t border-ip-line/70 align-top">
                      <td className="whitespace-pre-line py-2 pr-2">{l.description}</td>
                      <td className="py-2 text-right tabular-nums">
                        {l.quantity} {l.unit ?? ""}
                      </td>
                      <td className="py-2 text-right tabular-nums">{money(l.unitPrice, doc.currency)}</td>
                      <td className="py-2 text-right tabular-nums">{l.discountPercent ? `${l.discountPercent} %` : "—"}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{money(l.lineTotal ?? 0, doc.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm" data-testid="doc-totals">
              <div className="flex justify-between">
                <dt className="text-ip-muted">Sous-total</dt>
                <dd className="tabular-nums">{money(doc.subtotal, doc.currency)}</dd>
              </div>
              {Number(doc.discountAmount) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ip-muted">Remise</dt>
                  <dd className="tabular-nums">− {money(doc.discountAmount, doc.currency)}</dd>
                </div>
              )}
              {Number(doc.shippingAmount) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ip-muted">Livraison</dt>
                  <dd className="tabular-nums">{money(doc.shippingAmount, doc.currency)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ip-muted">Taxe ({doc.taxRate} %)</dt>
                <dd className="tabular-nums">{money(doc.taxTotal, doc.currency)}</dd>
              </div>
              <div className="flex justify-between border-t border-ip-line pt-1.5">
                <dt className="font-semibold">Total</dt>
                <dd className="font-heading text-lg font-bold tabular-nums" data-testid="doc-total">
                  {money(doc.total, doc.currency)}
                </dd>
              </div>
              {isInvoice && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-ip-muted">Payé</dt>
                    <dd className="tabular-nums" data-testid="doc-paid">
                      {money(doc.amountPaid, doc.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-semibold">Solde</dt>
                    <dd className="font-semibold tabular-nums" data-testid="doc-balance">
                      {money(doc.balance, doc.currency)}
                    </dd>
                  </div>
                </>
              )}
            </dl>
            {doc.notes && <p className="mt-4 rounded-xl bg-ip-mist p-3 text-sm">{doc.notes}</p>}
            {doc.internalNotes && <p className="mt-2 rounded-xl bg-ip-sun/20 p-3 text-sm">Note interne : {doc.internalNotes}</p>}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-2 font-heading text-lg font-bold">Actions</h2>
            <div className="flex flex-col gap-2">
              {canPay && (
                <Button variant="teal" onClick={() => setDlg("payment")} data-testid="doc-pay">
                  <CreditCard /> Enregistrer un paiement
                </Button>
              )}
              {canConvert && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setConvertTo(doc.type === "QUOTE" ? "PROFORMA" : "INVOICE");
                    setDlg("convert");
                  }}
                  data-testid="doc-convert"
                >
                  <FileOutput /> Convertir…
                </Button>
              )}
              {canWrite && doc.type !== "INVOICE" && ["SENT"].includes(doc.status) && (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDlg("accept")} data-testid="doc-accept">
                    <Check /> Accepté
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDlg("reject")}>
                    <X /> Refusé
                  </Button>
                </div>
              )}
              {canWrite && (
                <Button
                  variant="ghost"
                  onClick={() => run(() => post<BillingDocument>(`/admin/documents/${doc.id}/duplicate`), "Document dupliqué (brouillon).", (d) => router.push(`/documents/${d.id}`))}
                  disabled={busy}
                  data-testid="doc-duplicate"
                >
                  <Copy /> Dupliquer
                </Button>
              )}
              {canWrite && isDraft && (
                <Button variant="ghost" onClick={() => setDlg("delete")} data-testid="doc-delete">
                  <Trash2 /> Supprimer le brouillon
                </Button>
              )}
              {canVoid && !isDraft && (
                <Button variant="ghost" onClick={() => setDlg("void")} data-testid="doc-void">
                  <Ban /> Annuler le document
                </Button>
              )}
              {publicLink && !isDraft && (
                <div className="flex items-center gap-2 text-xs text-ip-muted">
                  <Link2 className="size-4 shrink-0" aria-hidden="true" />
                  <CopyButton value={typeof window !== "undefined" && publicLink.startsWith("/") ? `${window.location.origin}${publicLink}` : publicLink} label="Copier le lien public" />
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-2 font-heading text-lg font-bold">Détails</h2>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-ip-muted">Émission</dt>
                <dd>{dateFr(doc.issueDate)}</dd>
              </div>
              {doc.dueDate && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ip-muted">Échéance</dt>
                  <dd>{dateFr(doc.dueDate)}</dd>
                </div>
              )}
              {doc.validUntil && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ip-muted">Valable jusqu&apos;au</dt>
                  <dd>{dateFr(doc.validUntil)}</dd>
                </div>
              )}
              {doc.sentAt && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ip-muted">Envoyé</dt>
                  <dd className="text-right">
                    {dateFr(doc.sentAt, true)}
                    {doc.sentTo?.length ? <span className="block text-xs text-ip-muted">{doc.sentTo.join(", ")}</span> : null}
                  </dd>
                </div>
              )}
              {doc.orderId && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ip-muted">Commande</dt>
                  <dd>
                    <Link href={`/commandes/${doc.orderId}`} className="font-semibold text-ip-teal hover:underline">
                      {doc.orderReference ?? "Voir"}
                    </Link>
                  </dd>
                </div>
              )}
              {doc.parentId && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ip-muted">Issu de</dt>
                  <dd>
                    <Link href={`/documents/${doc.parentId}`} className="font-semibold text-ip-teal hover:underline">
                      {doc.parentNumber}
                    </Link>
                  </dd>
                </div>
              )}
              {doc.children.length > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ip-muted">Convertis en</dt>
                  <dd className="text-right">
                    {doc.children.map((c) => (
                      <Link key={c.id} href={`/documents/${c.id}`} className="block font-semibold text-ip-teal hover:underline" data-testid="child-link">
                        {c.number}
                      </Link>
                    ))}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-ip-muted">Client</dt>
                <dd className="text-right">
                  {doc.customerId && can("customers.read") ? (
                    <Link href={`/clients/${doc.customerId}`} className="font-semibold text-ip-teal hover:underline">
                      {doc.customer.name}
                    </Link>
                  ) : (
                    doc.customer.name
                  )}
                  <span className="block text-xs text-ip-muted">{doc.customer.email}</span>
                </dd>
              </div>
            </dl>
          </Card>

          {isInvoice && (
            <Card data-testid="payments-card">
              <h2 className="mb-2 font-heading text-lg font-bold">Paiements</h2>
              {doc.payments.length === 0 ? (
                <p className="text-sm text-ip-muted">Aucun paiement enregistré.</p>
              ) : (
                <ul className="space-y-2 text-sm" data-testid="payments">
                  {doc.payments.map((p) => (
                    <li key={p.id} className={`rounded-xl bg-ip-mist p-3 ${p.voidedAt ? "opacity-60" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-semibold tabular-nums ${p.voidedAt ? "line-through" : ""}`}>{money(p.amount, p.currency)}</span>
                        <Badge tone={p.voidedAt ? "red" : "green"}>{p.voidedAt ? "Annulé" : methodLabel(p.method)}</Badge>
                      </div>
                      <p className="text-xs text-ip-muted">
                        {dateFr(p.paidAt)} · {p.recordedBy.name}
                        {p.reference ? ` · réf. ${p.reference}` : ""}
                      </p>
                      {p.voidReason && <p className="text-xs">Motif : {p.voidReason}</p>}
                      {!p.voidedAt && can("payments.write") && (
                        <button
                          type="button"
                          className="mt-1 text-xs font-semibold text-red-700 underline"
                          onClick={() => {
                            setVoidPaymentId(p.id);
                            setDlg("voidPayment");
                          }}
                        >
                          Annuler ce paiement
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card>
            <h2 className="mb-2 font-heading text-lg font-bold">Historique</h2>
            <ol className="space-y-2" data-testid="doc-events">
              {doc.events.map((e) => (
                <li key={e.id} className="border-l-2 border-ip-teal/40 pl-3 text-sm">
                  <p>{e.message}</p>
                  <p className="text-xs text-ip-muted">
                    {e.actor?.name ?? "Système"} · {dateFr(e.createdAt, true)}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <SendDialog open={dlg === "send"} onClose={() => setDlg(null)} doc={doc} onDone={() => { setDlg(null); reload(); }} />
      <PaymentDialog open={dlg === "payment"} onClose={() => setDlg(null)} doc={doc} onDone={() => { setDlg(null); reload(); }} />

      <ConfirmDialog
        open={dlg === "convert"}
        onClose={() => setDlg(null)}
        onConfirm={() => run(() => post<BillingDocument>(`/admin/documents/${doc.id}/convert`, { to: convertTo }), "Document converti (brouillon créé).", (d) => router.push(`/documents/${d.id}`))}
        busy={busy}
        title="Convertir le document"
        confirmLabel="Convertir"
        testId="convert-dialog"
      >
        <p className="mb-3 text-sm text-ip-muted">Un nouveau brouillon est créé avec les mêmes lignes ; le document d&apos;origine est conservé.</p>
        <Field id="convert-to" label="Convertir en">
          <Select id="convert-to" value={convertTo} onChange={(e) => setConvertTo(e.target.value as "PROFORMA" | "INVOICE")} data-testid="convert-to">
            {doc.type === "QUOTE" && <option value="PROFORMA">Facture proforma</option>}
            <option value="INVOICE">Facture</option>
          </Select>
        </Field>
      </ConfirmDialog>

      <ConfirmDialog open={dlg === "void"} onClose={() => setDlg(null)} onConfirm={() => run(() => post(`/admin/documents/${doc.id}/void`, { reason }), "Document annulé.")} busy={busy} danger title={`Annuler ${doc.number} ?`} confirmLabel="Annuler le document" testId="void-dialog">
        <Field id="void-reason" label="Motif (obligatoire)" className="mt-2">
          <Textarea id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="void-reason" />
        </Field>
        {reason.trim().length === 0 && <p className="mt-1 text-xs text-ip-muted">Saisissez un motif pour confirmer.</p>}
      </ConfirmDialog>

      <ConfirmDialog open={dlg === "voidPayment"} onClose={() => setDlg(null)} onConfirm={() => run(() => post(`/admin/documents/${doc.id}/payments/${voidPaymentId}/void`, { reason }), "Paiement annulé.")} busy={busy} danger title="Annuler ce paiement ?" confirmLabel="Annuler le paiement">
        <Field id="vp-reason" label="Motif (obligatoire)" className="mt-2">
          <Textarea id="vp-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </ConfirmDialog>

      <ConfirmDialog open={dlg === "delete"} onClose={() => setDlg(null)} onConfirm={() => run(() => del(`/admin/documents/${doc.id}`), "Brouillon supprimé.", () => router.replace(DOC_TYPE[doc.type].path))} busy={busy} danger title="Supprimer ce brouillon ?" message="Cette action est définitive." confirmLabel="Supprimer" />
      <ConfirmDialog open={dlg === "accept"} onClose={() => setDlg(null)} onConfirm={() => run(() => post(`/admin/documents/${doc.id}/status`, { status: "ACCEPTED" }), "Marqué comme accepté.")} busy={busy} title="Marquer comme accepté ?" message="Le client a accepté ce document." confirmLabel="Accepté" />
      <ConfirmDialog open={dlg === "reject"} onClose={() => setDlg(null)} onConfirm={() => run(() => post(`/admin/documents/${doc.id}/status`, { status: "REJECTED" }), "Marqué comme refusé.")} busy={busy} title="Marquer comme refusé ?" confirmLabel="Refusé" />
    </>
  );
}

function SendDialog({ open, onClose, doc, onDone }: { open: boolean; onClose: () => void; doc: BillingDocument; onDone: () => void }) {
  const label = DOC_TYPE[doc.type].label;
  const [to, setTo] = React.useState(doc.customer.email);
  const [cc, setCc] = React.useState("");
  const [bcc, setBcc] = React.useState("");
  const [subject, setSubject] = React.useState(`${label} ${doc.number} — Impact Pro`);
  const [message, setMessage] = React.useState(`Bonjour ${doc.customer.name},\n\nVeuillez trouver ci-joint ${doc.type === "INVOICE" ? "votre facture" : doc.type === "QUOTE" ? "notre devis" : "notre facture proforma"} ${doc.number} d'un montant de ${money(doc.total, doc.currency)}.\n\nN'hésitez pas à nous contacter pour toute question.\n\nCordialement,\nL'équipe Impact Pro`);
  const [busy, setBusy] = React.useState(false);
  const [notConfigured, setNotConfigured] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setNotConfigured(false);
      setErr(null);
      setTo(doc.customer.email);
    }
  }, [open, doc.customer.email]);

  const list = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);

  async function send(markAsSentOnly: boolean) {
    const toList = list(to);
    if (!markAsSentOnly && (toList.length === 0 || toList.some((x) => !/^\S+@\S+\.\S+$/.test(x)))) {
      setErr("Saisissez au moins une adresse e-mail valide.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await post(`/admin/documents/${doc.id}/send`, markAsSentOnly ? { markAsSentOnly: true } : { to: toList, cc: list(cc), bcc: list(bcc), subject, message });
      toast.success(markAsSentOnly ? "Marqué comme envoyé." : "Document envoyé par e-mail.");
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.code === "MAIL_NOT_CONFIGURED") setNotConfigured(true);
      else setErr(e instanceof ApiError ? e.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Envoyer ${doc.number}`}
      wide
      testId="send-dialog"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Fermer
          </Button>
          <Button variant="outline" onClick={() => void send(true)} disabled={busy} data-testid="mark-sent">
            Marquer comme envoyé seulement
          </Button>
          <Button variant="sun" onClick={() => void send(false)} disabled={busy} data-testid="send-confirm">
            {busy ? <Loader2 className="animate-spin" /> : <Mail />} Envoyer par e-mail
          </Button>
        </>
      }
    >
      {notConfigured && (
        <div role="alert" data-testid="mail-not-configured" className="mb-4 rounded-xl border border-ip-sun bg-ip-sun/20 p-3 text-sm">
          <p className="font-semibold">La messagerie n&apos;est pas encore configurée.</p>
          <p className="mt-1">Le document n&apos;a pas été envoyé. Configurez la messagerie (voir « Messagerie »), ou transmettez le PDF par un autre canal (WhatsApp…) puis utilisez « Marquer comme envoyé seulement ».</p>
        </div>
      )}
      {err && (
        <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {err}
        </p>
      )}
      <div className="grid gap-3">
        <Field id="s-to" label="À (séparez par des virgules)" required>
          <Input id="s-to" value={to} onChange={(e) => setTo(e.target.value)} data-testid="send-to" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="s-cc" label="Cc">
            <Input id="s-cc" value={cc} onChange={(e) => setCc(e.target.value)} />
          </Field>
          <Field id="s-bcc" label="Cci">
            <Input id="s-bcc" value={bcc} onChange={(e) => setBcc(e.target.value)} />
          </Field>
        </div>
        <Field id="s-subject" label="Objet">
          <Input id="s-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field id="s-msg" label="Message" hint="Le PDF est joint automatiquement, avec un lien de téléchargement.">
          <Textarea id="s-msg" value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-40" />
        </Field>
      </div>
    </Dialog>
  );
}

function PaymentDialog({ open, onClose, doc, onDone }: { open: boolean; onClose: () => void; doc: BillingDocument; onDone: () => void }) {
  const [amount, setAmount] = React.useState(doc.balance);
  const [method, setMethod] = React.useState<PaymentMethod>("MONCASH");
  const [paidAt, setPaidAt] = React.useState(today());
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setAmount(doc.balance);
      setErr(null);
    }
  }, [open, doc.balance]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return setErr("Saisissez un montant supérieur à 0.");
    if (n > Number(doc.balance) + 0.0001) return setErr(`Le montant dépasse le solde (${money(doc.balance, doc.currency)}).`);
    setBusy(true);
    try {
      await post(`/admin/documents/${doc.id}/payments`, { amount: n.toFixed(2), method, paidAt, reference: reference || undefined, notes: notes || undefined });
      toast.success("Paiement enregistré.");
      onDone();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Enregistrer un paiement"
      testId="payment-dialog"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="payment-form" variant="teal" disabled={busy} data-testid="payment-save">
            {busy && <Loader2 className="animate-spin" />} Enregistrer
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={submit} className="grid gap-3" noValidate>
        <p className="text-sm text-ip-muted">
          Solde à payer : <strong>{money(doc.balance, doc.currency)}</strong>
        </p>
        {err && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {err}
          </p>
        )}
        <Field id="p-amount" label={`Montant (${doc.currency})`} required>
          <Input id="p-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="payment-amount" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="p-method" label="Mode de paiement">
            <Select id="p-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} data-testid="payment-method">
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="p-date" label="Date">
            <Input id="p-date" type="date" value={paidAt} max={today()} onChange={(e) => setPaidAt(e.target.value)} />
          </Field>
        </div>
        <Field id="p-ref" label="Référence (n° de transaction…)">
          <Input id="p-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field id="p-notes" label="Notes">
          <Textarea id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" />
        </Field>
      </form>
    </Dialog>
  );
}

export type { DocumentType };
