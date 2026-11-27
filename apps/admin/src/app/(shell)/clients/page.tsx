"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { CustomerFormDialog } from "@/components/customer-form";
import { Gate } from "@/components/gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton, TableWrap, Td, Th } from "@/components/ui/kit";
import { useAuth } from "@/lib/auth";
import { dateFr, money } from "@/lib/format";
import { useDebounced, useFetch } from "@/lib/hooks";
import type { CustomerListItem } from "@/lib/types";

export default function CustomersPage() {
  return (
    <Gate perm="customers.read">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const { can } = useAuth();
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [creating, setCreating] = React.useState(false);
  const dq = useDebounced(q);
  React.useEffect(() => setPage(1), [dq]);
  const { data, meta, loading, error, reload } = useFetch<CustomerListItem[]>("/admin/customers", { q: dq, page, pageSize: 20, sort: "createdAt:desc" });

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Annuaire des clients (commandes, comptes et saisies manuelles)."
        actions={
          can("customers.write") && (
            <Button variant="sun" onClick={() => setCreating(true)} data-testid="customer-new">
              <Plus /> Nouveau client
            </Button>
          )
        }
      />
      <div className="relative mb-4 max-w-lg">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ip-muted" aria-hidden="true" />
        <Input aria-label="Rechercher un client" placeholder="Nom, société, e-mail, téléphone…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="customers-search" />
      </div>
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <TableSkeleton cols={5} />
      ) : data && data.length === 0 ? (
        <EmptyState title="Aucun client" text="Aucun client ne correspond à cette recherche." />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Contact</Th>
                <Th className="text-right">Commandes</Th>
                <Th>Dernière commande</Th>
                <Th className="text-right">Solde dû</Th>
              </tr>
            </thead>
            <tbody data-testid="customers-rows">
              {data?.map((c) => (
                <tr key={c.id} className="hover:bg-ip-mist/60">
                  <Td>
                    <Link href={`/clients/${c.id}`} className="font-semibold text-ip-teal hover:underline">
                      {c.fullName}
                    </Link>
                    {c.company && <span className="block text-xs text-ip-muted">{c.company}</span>}
                  </Td>
                  <Td>
                    <span className="block">{c.email}</span>
                    <span className="block text-xs text-ip-muted">{c.phone ?? ""}</span>
                  </Td>
                  <Td className="text-right tabular-nums">{c.ordersCount}</Td>
                  <Td>{dateFr(c.lastOrderAt)}</Td>
                  <Td className="text-right tabular-nums">
                    {c.balances.filter((b) => Number(b.due) > 0).length === 0 ? <span className="text-ip-muted">—</span> : c.balances.filter((b) => Number(b.due) > 0).map((b) => <span key={b.currency} className="block">{money(b.due, b.currency)}</span>)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination meta={meta} onPage={setPage} />
        </>
      )}
      <CustomerFormDialog open={creating} onClose={() => setCreating(false)} onSaved={() => reload()} />
    </>
  );
}
