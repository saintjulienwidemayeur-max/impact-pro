"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Gate } from "@/components/gate";
import { Input, Select } from "@/components/ui/field";
import { Badge, EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton, TableWrap, Td, Th } from "@/components/ui/kit";
import { dateFr, PROJECT_SIZE, QUOTE_REQUEST_STATUS, QUOTE_SERVICE } from "@/lib/format";
import { useDebounced, useFetch } from "@/lib/hooks";
import { QUOTE_REQUEST_STATUSES, type QuoteRequest, type QuoteRequestService } from "@/lib/types";

export default function QuoteRequestsPage() {
  return (
    <Gate perm="quotes.read">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [service, setService] = React.useState("");
  const [page, setPage] = React.useState(1);
  const dq = useDebounced(q);
  React.useEffect(() => setPage(1), [dq, status, service]);
  const { data, meta, loading, error, reload } = useFetch<QuoteRequest[]>("/admin/quote-requests", {
    q: dq || undefined,
    status: status || undefined,
    service: service || undefined,
    page,
    pageSize: 20,
    sort: "createdAt:desc",
  });
  const newCount = (meta as (typeof meta & { newCount?: number }) | null)?.newCount;

  return (
    <>
      <PageHeader
        title="Demandes de proforma"
        subtitle={`Demandes envoyées depuis le site (articles, sourcing, événements, conseil).${newCount ? ` ${newCount} nouvelle${newCount > 1 ? "s" : ""} à traiter.` : ""}`}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-lg flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ip-muted" aria-hidden="true" />
          <Input aria-label="Rechercher une demande" placeholder="Référence, nom, société, e-mail, projet…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="requests-search" />
        </div>
        <Select aria-label="Filtrer par statut" value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48" data-testid="requests-status">
          <option value="">Tous les statuts</option>
          {QUOTE_REQUEST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {QUOTE_REQUEST_STATUS[s].label}
            </option>
          ))}
        </Select>
        <Select aria-label="Filtrer par service" value={service} onChange={(e) => setService(e.target.value)} className="sm:w-56">
          <option value="">Tous les services</option>
          {(Object.keys(QUOTE_SERVICE) as QuoteRequestService[]).map((s) => (
            <option key={s} value={s}>
              {QUOTE_SERVICE[s]}
            </option>
          ))}
        </Select>
      </div>
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <TableSkeleton cols={5} />
      ) : data && data.length === 0 ? (
        <EmptyState title="Aucune demande" text="Les demandes envoyées depuis le formulaire « Demander une proforma » du site apparaîtront ici." />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>Demande</Th>
                <Th>Client</Th>
                <Th>Service</Th>
                <Th>Projet</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody data-testid="requests-rows">
              {data?.map((r) => (
                <tr key={r.id} className="hover:bg-ip-mist/60">
                  <Td>
                    <Link href={`/demandes/${r.id}`} className="font-semibold text-ip-teal hover:underline">
                      {r.reference}
                    </Link>
                    <span className="block text-xs text-ip-muted">{dateFr(r.createdAt)}</span>
                  </Td>
                  <Td>
                    <span className="block font-medium">{r.fullName}</span>
                    <span className="block text-xs text-ip-muted">{r.company ?? r.email}</span>
                  </Td>
                  <Td>
                    {QUOTE_SERVICE[r.service]}
                    {r.size && <span className="block text-xs text-ip-muted">{PROJECT_SIZE[r.size]}</span>}
                  </Td>
                  <Td className="max-w-xs">
                    <span className="line-clamp-2 text-sm">{r.project}</span>
                  </Td>
                  <Td>
                    <Badge tone={QUOTE_REQUEST_STATUS[r.status].tone}>{QUOTE_REQUEST_STATUS[r.status].label}</Badge>
                  </Td>
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
