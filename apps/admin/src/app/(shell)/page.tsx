"use client";

import Link from "next/link";
import { OrderStatusBadge } from "@/components/badges";
import { Gate } from "@/components/gate";
import { BarList, Card, ErrorState, PageHeader, Skeleton, Stat } from "@/components/ui/kit";
import { AUDIT_ACTION_LABELS, dateFr, money, ORDER_STATUS } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useFetch } from "@/lib/hooks";
import type { Dashboard, OrderStatus } from "@/lib/types";

export default function DashboardPage() {
  return (
    <Gate perm="dashboard.read">
      <DashboardInner />
    </Gate>
  );
}

function DashboardInner() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch<Dashboard>("/admin/dashboard");

  return (
    <>
      <PageHeader title={`Bonjour ${user?.fullName?.split(" ")[0] ?? ""}`.trim()} subtitle="Vue d'ensemble de l'activité Impact Pro." />
      {error && <ErrorState message={error.message} onRetry={reload} />}
      {loading && !data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Chargement">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}
      {data && (
        <div className="space-y-5" data-testid="dashboard">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Commandes (7 jours)" value={data.orders.last7d} hint={`${data.orders.last30d} sur 30 jours · ${data.orders.total} au total`} />
            <Stat label="Clients" value={data.customers.total} hint={`${data.customers.new30d} nouveaux (30 jours)`} tone="cyan" />
            <Stat label="Factures impayées" value={data.documents.unpaidInvoices} hint={`${data.documents.overdueInvoices} en retard`} tone={data.documents.overdueInvoices ? "red" : "sun"} />
            <Stat label="Devis en cours" value={data.documents.openQuotes} hint={`${data.documents.draftQuotes} brouillon(s)`} tone="sun" />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <h2 className="mb-3 font-heading text-lg font-bold">Encaissements et soldes</h2>
              {data.revenue.length === 0 ? (
                <p className="text-sm text-ip-muted">Aucune facture pour le moment.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[28rem] text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-ip-muted">
                        <th className="pb-2">Devise</th>
                        <th className="pb-2 text-right">Encaissé 7 j</th>
                        <th className="pb-2 text-right">Encaissé 30 j</th>
                        <th className="pb-2 text-right">À encaisser</th>
                        <th className="pb-2 text-right">En retard</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.revenue.map((r) => (
                        <tr key={r.currency} className="border-t border-ip-line/70">
                          <td className="py-2 font-semibold">{r.currency}</td>
                          <td className="py-2 text-right tabular-nums">{money(r.paid7d, r.currency)}</td>
                          <td className="py-2 text-right tabular-nums">{money(r.paid30d, r.currency)}</td>
                          <td className="py-2 text-right tabular-nums">{money(r.outstanding, r.currency)}</td>
                          <td className="py-2 text-right tabular-nums text-red-700">{money(r.overdue, r.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card>
              <h2 className="mb-3 font-heading text-lg font-bold">Commandes par statut</h2>
              <BarList
                rows={(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => ({ label: ORDER_STATUS[s].label, value: data.orders.byStatus[s] ?? 0, tone: s === "CANCELLED" ? "bg-red-500" : "bg-ip-teal" }))}
              />
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-heading text-lg font-bold">Commandes récentes</h2>
                <Link href="/commandes" className="text-sm font-semibold text-ip-teal underline">
                  Tout voir
                </Link>
              </div>
              {data.recentOrders.length === 0 ? (
                <p className="text-sm text-ip-muted">Aucune commande.</p>
              ) : (
                <ul className="divide-y divide-ip-line/70">
                  {data.recentOrders.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div>
                        <Link href={`/commandes/${o.id}`} className="font-semibold text-ip-teal hover:underline">
                          {o.reference}
                        </Link>
                        <p className="text-xs text-ip-muted">
                          {o.customerName} · {dateFr(o.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm tabular-nums">{money(o.subtotal, o.currency)}</span>
                        <OrderStatusBadge status={o.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <div className="space-y-5">
              <Card>
                <h2 className="mb-3 font-heading text-lg font-bold">Produits les plus commandés (30 j)</h2>
                {data.topProducts.length === 0 ? (
                  <p className="text-sm text-ip-muted">Pas encore de données.</p>
                ) : (
                  <BarList rows={data.topProducts.map((p) => ({ label: p.productName, value: p.quantity }))} />
                )}
              </Card>
              {data.mail && (
                <Card>
                  <h2 className="font-heading text-lg font-bold">Messagerie</h2>
                  <p className="mt-1 text-sm">
                    <Link href="/messagerie" className="font-semibold text-ip-teal underline">
                      {data.mail.unread} message(s) non lu(s)
                    </Link>
                  </p>
                </Card>
              )}
            </div>
          </div>

          <Card>
            <h2 className="mb-3 font-heading text-lg font-bold">Activité récente</h2>
            {data.activity.length === 0 ? (
              <p className="text-sm text-ip-muted">Aucune activité.</p>
            ) : (
              <ul className="divide-y divide-ip-line/70 text-sm">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <strong>{a.actor?.name ?? "Système"}</strong> · {AUDIT_ACTION_LABELS[a.action] ?? a.action} <span className="text-ip-muted">({a.entityType})</span>
                    </span>
                    <span className="text-xs text-ip-muted">{dateFr(a.createdAt, true)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
