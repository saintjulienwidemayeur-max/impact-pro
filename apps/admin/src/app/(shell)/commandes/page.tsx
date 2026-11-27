"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { OrderStatusBadge } from "@/components/badges";
import { Gate } from "@/components/gate";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton, TableWrap, Td, Th } from "@/components/ui/kit";
import { dateFr, money, ORDER_STATUS } from "@/lib/format";
import { useDebounced, useFetch } from "@/lib/hooks";
import type { OrderListItem, OrderStatus } from "@/lib/types";

export default function OrdersPage() {
  return (
    <Gate perm="orders.read">
      <OrdersInner />
    </Gate>
  );
}

function OrdersInner() {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const dq = useDebounced(q);
  React.useEffect(() => setPage(1), [dq, status, from, to]);
  const { data, meta, loading, error, reload } = useFetch<OrderListItem[]>("/admin/orders", { q: dq, status, from, to, page, pageSize: 20, sort: "createdAt:desc" });

  return (
    <>
      <PageHeader title="Commandes" subtitle="Toutes les commandes reçues du site." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ip-muted" aria-hidden="true" />
          <Input aria-label="Rechercher une commande" placeholder="Référence, nom, société, e-mail, téléphone…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="orders-search" />
        </div>
        <Select aria-label="Filtrer par statut" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="orders-status">
          <option value="">Tous les statuts</option>
          {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS[s].label}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" aria-label="Du" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" aria-label="Au" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <TableSkeleton cols={6} />
      ) : data && data.length === 0 ? (
        <EmptyState title="Aucune commande" text="Aucune commande ne correspond à ces filtres." />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>Référence</Th>
                <Th>Client</Th>
                <Th>Date</Th>
                <Th className="text-right">Articles</Th>
                <Th className="text-right">Total</Th>
                <Th>Statut</Th>
                <Th>Docs</Th>
              </tr>
            </thead>
            <tbody data-testid="orders-rows">
              {data?.map((o) => (
                <tr key={o.id} className="hover:bg-ip-mist/60">
                  <Td>
                    <Link href={`/commandes/${o.id}`} className="font-semibold text-ip-teal hover:underline">
                      {o.reference}
                    </Link>
                  </Td>
                  <Td>
                    <span className="font-medium">{o.customerName}</span>
                    <span className="block text-xs text-ip-muted">{o.company ? `${o.company} · ` : ""}{o.email}</span>
                  </Td>
                  <Td className="whitespace-nowrap">{dateFr(o.createdAt)}</Td>
                  <Td className="text-right tabular-nums">{o.itemCount}</Td>
                  <Td className="text-right tabular-nums">{money(o.subtotal, o.currency)}</Td>
                  <Td>
                    <OrderStatusBadge status={o.status} />
                  </Td>
                  <Td>{o.hasDocuments ? "Oui" : <span className="text-ip-muted">—</span>}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination meta={meta} onPage={setPage} />
        </>
      )}
    </>
  );
}
