"use client";

import { Download, Plus, Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { DocStatusBadge } from "@/components/badges";
import { Gate } from "@/components/gate";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton, TableWrap, Td, Th } from "@/components/ui/kit";
import { useAuth } from "@/lib/auth";
import { DOC_STATUS, DOC_TYPE, dateFr, money } from "@/lib/format";
import { useDebounced, useFetch } from "@/lib/hooks";
import { documentReadPerm, documentWritePerm } from "@/lib/permissions";
import type { DocumentStatus, DocumentSummary, DocumentType } from "@/lib/types";

const STATUSES: Record<DocumentType, DocumentStatus[]> = {
  QUOTE: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "VOID"],
  PROFORMA: ["DRAFT", "SENT", "ACCEPTED", "VOID"],
  INVOICE: ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "VOID"],
};

/** List of quotes / proformas / invoices with filters, search and overdue badges. */
export function DocumentsList({ type }: { type: DocumentType }) {
  return (
    <Gate perm={documentReadPerm(type)}>
      <Inner type={type} />
    </Gate>
  );
}

function Inner({ type }: { type: DocumentType }) {
  const { can } = useAuth();
  const meta = DOC_TYPE[type];
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [overdue, setOverdue] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const dq = useDebounced(q);
  React.useEffect(() => setPage(1), [dq, status, overdue]);
  const { data, meta: pg, loading, error, reload } = useFetch<DocumentSummary[]>("/admin/documents", { type, q: dq, status, overdue: overdue || undefined, page, pageSize: 20, sort: "createdAt:desc" });

  return (
    <>
      <PageHeader
        title={meta.plural}
        subtitle={type === "INVOICE" ? "Factures émises, paiements et retards." : type === "QUOTE" ? "Devis préparés pour les clients." : "Factures proforma (avant paiement)."}
        actions={
          <>
            <a href={`/api/v1/admin/documents/export.csv?type=${type}`} className="inline-flex h-9 items-center gap-2 rounded-xl border-2 border-ip-teal px-3 text-sm font-semibold text-ip-teal hover:bg-ip-teal hover:text-white" data-testid="export-csv">
              <Download className="size-4" aria-hidden="true" /> Export CSV
            </a>
            {can(documentWritePerm(type)) && (
              <Link href={`/documents/new?type=${type}`} data-testid="doc-new" className="inline-flex h-9 items-center gap-2 rounded-xl bg-ip-sun px-3 text-sm font-semibold text-ip-ink hover:bg-ip-sun-600">
                <Plus className="size-4" aria-hidden="true" /> Nouveau
              </Link>
            )}
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ip-muted" aria-hidden="true" />
          <Input aria-label="Rechercher" placeholder="Numéro, client…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="docs-search" />
        </div>
        <Select aria-label="Filtrer par statut" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="docs-status">
          <option value="">Tous les statuts</option>
          {STATUSES[type].map((s) => (
            <option key={s} value={s}>
              {DOC_STATUS[s].label}
            </option>
          ))}
        </Select>
        {type === "INVOICE" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} className="size-4 accent-ip-teal" /> En retard seulement
          </label>
        )}
      </div>
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <TableSkeleton cols={6} />
      ) : data && data.length === 0 ? (
        <EmptyState title={`Aucun document`} text="Aucun résultat pour ces filtres." />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>Numéro</Th>
                <Th>Client</Th>
                <Th>Date</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Solde</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody data-testid="docs-rows">
              {data?.map((d) => (
                <tr key={d.id} className="hover:bg-ip-mist/60">
                  <Td>
                    <Link href={`/documents/${d.id}`} className="font-semibold text-ip-teal hover:underline">
                      {d.number}
                    </Link>
                  </Td>
                  <Td>{d.customerName}</Td>
                  <Td className="whitespace-nowrap">{dateFr(d.issueDate)}</Td>
                  <Td className="text-right tabular-nums">{money(d.total, d.currency)}</Td>
                  <Td className="text-right tabular-nums">{type === "INVOICE" ? money(d.balance, d.currency) : "—"}</Td>
                  <Td>
                    <DocStatusBadge status={d.status} overdue={d.isOverdue} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination meta={pg} onPage={setPage} />
        </>
      )}
    </>
  );
}
