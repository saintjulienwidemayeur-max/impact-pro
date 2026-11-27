"use client";

import { ArrowLeft, Check, Download, FilePlus2, Loader2, Receipt, StickyNote } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { DocStatusBadge, OrderStatusBadge } from "@/components/badges";
import { Gate } from "@/components/gate";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Badge, Card, ConfirmDialog, ErrorState, PageHeader, Skeleton } from "@/components/ui/kit";
import { ApiError, patch, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateFr, money, ORDER_STATUS, PLACEMENT_LABELS } from "@/lib/format";
import { useFetch } from "@/lib/hooks";
import { ORDER_FLOW, type OrderDetail, type OrderElement, type OrderItem, type OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function OrderDetailPage() {
  return (
    <Gate perm="orders.read">
      <Inner />
    </Gate>
  );
}

/** Allowed next statuses (docs/admin-contract.md §2): forward along the flow, CANCELLED from non-delivered, reopen. */
function allowedNext(status: OrderStatus, role: string | undefined): OrderStatus[] {
  if (status === "CANCELLED") return role === "ADMIN" || role === "SUPER_ADMIN" ? ["RECEIVED"] : [];
  if (status === "DELIVERED") return [];
  const i = ORDER_FLOW.indexOf(status);
  return [...(ORDER_FLOW[i + 1] ? [ORDER_FLOW[i + 1]] : []), "CANCELLED"];
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const { can, user } = useAuth();
  const { data: o, loading, error, reload } = useFetch<OrderDetail>(`/admin/orders/${id}`);
  const [target, setTarget] = React.useState<OrderStatus | null>(null);
  const [statusNote, setStatusNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [noteBusy, setNoteBusy] = React.useState(false);

  if (error) return <ErrorState message={error.status === 404 ? "Commande introuvable." : error.message} onRetry={reload} />;
  if (loading && !o) return <Skeleton className="h-64" />;
  if (!o) return null;
  const canWrite = can("orders.write");
  const next = canWrite ? allowedNext(o.status, user?.staffRole) : [];

  async function changeStatus() {
    if (!target) return;
    setBusy(true);
    try {
      await patch(`/admin/orders/${id}/status`, { status: target, note: statusNote.trim() || undefined });
      toast.success(`Statut : ${ORDER_STATUS[target].label}`);
      setTarget(null);
      setStatusNote("");
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Échec du changement de statut.");
    } finally {
      setBusy(false);
    }
  }
  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setNoteBusy(true);
    try {
      await post(`/admin/orders/${id}/notes`, { message: note.trim() });
      setNote("");
      toast.success("Note ajoutée.");
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Échec de l'ajout.");
    } finally {
      setNoteBusy(false);
    }
  }

  const stepIndex = o.status === "CANCELLED" ? -1 : ORDER_FLOW.indexOf(o.status);

  return (
    <>
      <Link href="/commandes" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ip-teal hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Commandes
      </Link>
      <PageHeader
        title={o.reference}
        subtitle={`Reçue le ${dateFr(o.createdAt, true)}`}
        actions={
          <>
            <OrderStatusBadge status={o.status} />
            {can("quotes.write") && (
              <Link href={`/documents/new?type=QUOTE&orderId=${o.id}`} data-testid="create-quote" className="inline-flex h-9 items-center gap-2 rounded-xl bg-ip-sun px-3 text-sm font-semibold text-ip-ink hover:bg-ip-sun-600">
                <FilePlus2 className="size-4" aria-hidden="true" /> Créer un devis
              </Link>
            )}
            {can("invoices.write") && (
              <Link href={`/documents/new?type=INVOICE&orderId=${o.id}`} data-testid="create-invoice" className="inline-flex h-9 items-center gap-2 rounded-xl border-2 border-ip-teal px-3 text-sm font-semibold text-ip-teal hover:bg-ip-teal hover:text-white">
                <Receipt className="size-4" aria-hidden="true" /> Créer une facture
              </Link>
            )}
          </>
        }
      />

      <Card className="mb-5" data-testid="status-stepper">
        <ol className="grid gap-2 sm:grid-cols-6" aria-label="Progression de la commande">
          {ORDER_FLOW.map((s, i) => {
            const done = i <= stepIndex;
            return (
              <li key={s} className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-sm", done ? "bg-ip-teal text-white" : "bg-ip-mist text-ip-muted")} aria-current={i === stepIndex ? "step" : undefined}>
                <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold", done ? "bg-white text-ip-teal" : "bg-white text-ip-muted")}>{done ? <Check className="size-3" /> : i + 1}</span>
                {ORDER_STATUS[s].label}
              </li>
            );
          })}
        </ol>
        {o.status === "CANCELLED" && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">Cette commande est annulée.</p>}
        {next.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-ip-muted">Changer le statut :</span>
            {next.map((s) => (
              <Button key={s} size="sm" variant={s === "CANCELLED" ? "ink" : "teal"} onClick={() => setTarget(s)} data-testid={`to-${s}`}>
                {s === "CANCELLED" ? "Annuler la commande" : s === "RECEIVED" ? "Rouvrir" : `→ ${ORDER_STATUS[s].label}`}
              </Button>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {o.items.map((it) => (
            <ItemCard key={it.id} item={it} currency={o.currency} />
          ))}
          <Card>
            <p className="flex justify-between text-sm">
              <span className="font-semibold">Sous-total commande</span>
              <span className="font-heading text-lg font-bold tabular-nums" data-testid="order-subtotal">
                {money(o.subtotal, o.currency)}
              </span>
            </p>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-2 font-heading text-lg font-bold">Client</h2>
            <p className="font-semibold">{o.customerName}</p>
            {o.company && <p className="text-sm">{o.company}</p>}
            <p className="text-sm">
              <a href={`mailto:${o.email}`} className="text-ip-teal underline">
                {o.email}
              </a>
            </p>
            <p className="text-sm">{o.phone}</p>
            <p className="mt-2 text-sm text-ip-muted">{o.deliveryMethod === "PICKUP" ? "Retrait en boutique" : `Livraison : ${[o.address, o.city].filter(Boolean).join(", ") || "—"}`}</p>
            {o.notes && <p className="mt-2 rounded-xl bg-ip-mist p-3 text-sm">{o.notes}</p>}
            {o.customer && can("customers.read") && (
              <Link href={`/clients/${o.customer.id}`} className="mt-3 inline-block text-sm font-semibold text-ip-teal underline">
                Voir la fiche client
              </Link>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 font-heading text-lg font-bold">Documents</h2>
            {o.documents.length === 0 ? (
              <p className="text-sm text-ip-muted">Aucun devis ni facture pour cette commande.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {o.documents.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/documents/${d.id}`} className="font-semibold text-ip-teal hover:underline">
                      {d.number}
                    </Link>
                    <DocStatusBadge status={d.status} overdue={d.isOverdue} />
                    <span className="w-full text-xs text-ip-muted">{money(d.total, d.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 font-heading text-lg font-bold">Historique</h2>
            {canWrite && (
              <form onSubmit={addNote} className="mb-4 space-y-2">
                <Field id="note" label="Note interne (invisible pour le client)">
                  <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" data-testid="note-input" />
                </Field>
                <Button type="submit" size="sm" variant="outline" disabled={noteBusy || !note.trim()} data-testid="note-add">
                  {noteBusy ? <Loader2 className="animate-spin" /> : <StickyNote />} Ajouter la note
                </Button>
              </form>
            )}
            <ol className="space-y-3" data-testid="timeline">
              {o.events.map((ev) => (
                <li key={ev.id} className="border-l-2 border-ip-teal/40 pl-3 text-sm">
                  <p>
                    <Badge tone={ev.type === "NOTE" ? "sun" : ev.type === "STATUS" ? "teal" : "gray"}>{{ STATUS: "Statut", NOTE: "Note", DOCUMENT: "Document", EMAIL: "E-mail" }[ev.type]}</Badge>{" "}
                    {ev.message}
                  </p>
                  <p className="text-xs text-ip-muted">
                    {ev.actor?.name ?? "Système"} · {dateFr(ev.createdAt, true)}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={changeStatus}
        busy={busy}
        danger={target === "CANCELLED"}
        title={target ? `Passer à « ${ORDER_STATUS[target].label} »` : ""}
        confirmLabel="Valider"
        testId="status-dialog"
      >
        <Field id="status-note" label="Note (facultative)" className="mt-1">
          <Select id="status-note-preset" aria-label="Modèle de note" value="" onChange={(e) => e.target.value && setStatusNote(e.target.value)} className="mb-2">
            <option value="">Insérer un modèle…</option>
            <option value="Maquette envoyée au client par e-mail.">Maquette envoyée au client</option>
            <option value="Paiement reçu, lancement de la production.">Paiement reçu</option>
            <option value="Client prévenu par téléphone.">Client prévenu par téléphone</option>
          </Select>
          <Textarea id="status-note" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} className="min-h-20" />
        </Field>
      </ConfirmDialog>
    </>
  );
}

function elementLabel(e: OrderElement): string {
  if (e.kind === "TEXT") return `Texte « ${e.text ?? ""} »${e.font ? ` · ${e.font}` : ""}${e.color ? ` · ${e.color}` : ""}`;
  return e.kind === "ARTWORK" ? "Fichier prêt à imprimer" : "Logo";
}

function ItemCard({ item, currency }: { item: OrderItem; currency: string }) {
  const zones = Array.from(new Set(item.elements.map((e) => e.placement)));
  return (
    <Card data-testid="order-item">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-heading text-lg font-bold">{item.productName}</h3>
          <p className="text-sm text-ip-muted">
            {[item.color && `Couleur : ${item.color}`, item.size && `Taille : ${item.size}`, item.widthCm && item.heightCm ? `${item.widthCm} × ${item.heightCm} cm${item.areaM2 ? ` (${item.areaM2} m²)` : ""}` : null].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="tabular-nums">
            {item.quantity} × {money(item.unitPrice, currency)}
          </p>
          <p className="font-heading font-bold tabular-nums">{money(item.lineTotal, currency)}</p>
        </div>
      </div>

      {item.previews.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ip-muted">Maquettes vues par le client</p>
          <div className="flex flex-wrap gap-3">
            {item.previews.map((p) => (
              <a key={p.placement} href={p.url} target="_blank" rel="noreferrer" className="group block w-36">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Maquette ${PLACEMENT_LABELS[p.placement] ?? p.placement}`} className="h-28 w-full rounded-xl border border-ip-line bg-ip-mist object-contain" />
                <span className="mt-1 flex items-center gap-1 text-xs text-ip-teal group-hover:underline">
                  <Download className="size-3" aria-hidden="true" /> {PLACEMENT_LABELS[p.placement] ?? p.placement}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {zones.map((z) => (
        <div key={z} className="mt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ip-muted">Zone : {PLACEMENT_LABELS[z] ?? z}</p>
          <ul className="space-y-2">
            {item.elements
              .filter((e) => e.placement === z)
              .map((e, i) => (
                <li key={i} className="flex flex-wrap items-center gap-3 rounded-xl bg-ip-mist px-3 py-2 text-sm">
                  {e.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.logoUrl} alt="" className="size-12 rounded-lg border border-ip-line bg-white object-contain" />
                  )}
                  <span className="min-w-0 flex-1">
                    {elementLabel(e)}
                    {e.originalName && <span className="block truncate text-xs text-ip-muted">{e.originalName}</span>}
                  </span>
                  {e.logoUrl && (
                    <a href={e.logoUrl} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-1 text-xs font-semibold text-ip-teal hover:underline">
                      <Download className="size-3.5" aria-hidden="true" /> Télécharger
                    </a>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
      {item.notes && <p className="mt-3 rounded-xl bg-ip-sun/20 p-3 text-sm">Précisions : {item.notes}</p>}
    </Card>
  );
}
