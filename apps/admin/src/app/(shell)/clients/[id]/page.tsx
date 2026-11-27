"use client";

import { ArrowLeft, FilePlus2, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";
import { DocStatusBadge, OrderStatusBadge } from "@/components/badges";
import { CustomerFormDialog } from "@/components/customer-form";
import { Gate } from "@/components/gate";
import { Button } from "@/components/ui/button";
import { Card, ErrorState, PageHeader, Skeleton } from "@/components/ui/kit";
import { useAuth } from "@/lib/auth";
import { DOC_TYPE, dateFr, money } from "@/lib/format";
import { useFetch } from "@/lib/hooks";
import type { CustomerDetail } from "@/lib/types";

export default function CustomerDetailPage() {
  return (
    <Gate perm="customers.read">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { data: c, loading, error, reload } = useFetch<CustomerDetail>(`/admin/customers/${id}`);
  const [editing, setEditing] = React.useState(false);

  if (error) return <ErrorState message={error.status === 404 ? "Client introuvable." : error.message} onRetry={reload} />;
  if (loading && !c) return <Skeleton className="h-64" />;
  if (!c) return null;

  return (
    <>
      <Link href="/clients" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ip-teal hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Clients
      </Link>
      <PageHeader
        title={c.fullName}
        subtitle={c.company ?? undefined}
        actions={
          <>
            {can("customers.write") && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="customer-edit">
                <Pencil /> Modifier
              </Button>
            )}
            {can("quotes.write") && (
              <Link href={`/documents/new?type=QUOTE&customerId=${c.id}`} className="inline-flex h-9 items-center gap-2 rounded-xl bg-ip-sun px-3 text-sm font-semibold text-ip-ink hover:bg-ip-sun-600">
                <FilePlus2 className="size-4" aria-hidden="true" /> Nouveau devis
              </Link>
            )}
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5">
          <Card>
            <h2 className="mb-2 font-heading text-lg font-bold">Coordonnées</h2>
            <dl className="space-y-1 text-sm">
              <div>
                <dt className="inline text-ip-muted">E-mail : </dt>
                <dd className="inline">
                  <a href={`mailto:${c.email}`} className="text-ip-teal underline">
                    {c.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="inline text-ip-muted">Téléphone : </dt>
                <dd className="inline">{c.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="inline text-ip-muted">Adresse : </dt>
                <dd className="inline">{[c.address, c.city, c.country].filter(Boolean).join(", ") || "—"}</dd>
              </div>
              {c.taxId && (
                <div>
                  <dt className="inline text-ip-muted">N° fiscal : </dt>
                  <dd className="inline">{c.taxId}</dd>
                </div>
              )}
              <div>
                <dt className="inline text-ip-muted">Compte en ligne : </dt>
                <dd className="inline">{c.userId ? "Oui" : "Non (invité)"}</dd>
              </div>
            </dl>
            {c.notes && <p className="mt-3 rounded-xl bg-ip-mist p-3 text-sm">{c.notes}</p>}
          </Card>
          <Card>
            <h2 className="mb-2 font-heading text-lg font-bold">Soldes</h2>
            {c.balances.length === 0 ? (
              <p className="text-sm text-ip-muted">Aucune facture.</p>
            ) : (
              <ul className="space-y-2 text-sm" data-testid="balances">
                {c.balances.map((b) => (
                  <li key={b.currency} className="rounded-xl bg-ip-mist p-3">
                    <p className="font-semibold">{b.currency}</p>
                    <p>Facturé : {money(b.billed, b.currency)}</p>
                    <p>Payé : {money(b.paid, b.currency)}</p>
                    <p className={Number(b.due) > 0 ? "font-semibold text-red-700" : ""}>Dû : {money(b.due, b.currency)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <h2 className="mb-2 font-heading text-lg font-bold">Commandes ({c.orders.length})</h2>
            {c.orders.length === 0 ? (
              <p className="text-sm text-ip-muted">Aucune commande.</p>
            ) : (
              <ul className="divide-y divide-ip-line/70 text-sm">
                {c.orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/commandes/${o.id}`} className="font-semibold text-ip-teal hover:underline">
                      {o.reference}
                    </Link>
                    <span className="text-ip-muted">{dateFr(o.createdAt)}</span>
                    <span className="tabular-nums">{money(o.subtotal, o.currency)}</span>
                    <OrderStatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="mb-2 font-heading text-lg font-bold">Documents ({c.documents.length})</h2>
            {c.documents.length === 0 ? (
              <p className="text-sm text-ip-muted">Aucun devis ni facture.</p>
            ) : (
              <ul className="divide-y divide-ip-line/70 text-sm">
                {c.documents.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/documents/${d.id}`} className="font-semibold text-ip-teal hover:underline">
                      {d.number}
                    </Link>
                    <span className="text-ip-muted">{DOC_TYPE[d.type].label}</span>
                    <span className="tabular-nums">{money(d.total, d.currency)}</span>
                    <DocStatusBadge status={d.status} overdue={d.isOverdue} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <CustomerFormDialog open={editing} onClose={() => setEditing(false)} customer={c} onSaved={() => reload()} />
    </>
  );
}
