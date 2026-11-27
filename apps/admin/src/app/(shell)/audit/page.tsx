"use client";

import * as React from "react";
import { Gate } from "@/components/gate";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton, TableWrap, Td, Th } from "@/components/ui/kit";
import { AUDIT_ACTION_LABELS, dateFr } from "@/lib/format";
import { useFetch } from "@/lib/hooks";
import type { AuditEntry } from "@/lib/types";

export default function AuditPage() {
  return (
    <Gate perm="audit.read">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const [action, setAction] = React.useState("");
  const [entityType, setEntityType] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [action, entityType, from, to]);
  const { data, meta, loading, error, reload } = useFetch<AuditEntry[]>("/admin/audit-logs", { action, entityType, from, to, page, pageSize: 30 });

  return (
    <>
      <PageHeader title="Journal d'audit" subtitle="Qui a fait quoi, et quand. Les entrées ne peuvent pas être modifiées." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)} data-testid="audit-action">
          <option value="">Toutes les actions</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select aria-label="Type d'objet" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="">Tous les objets</option>
          {["User", "CustomOrder", "Document", "Payment", "Customer", "Product", "BillingSettings"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Input type="date" aria-label="Du" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" aria-label="Au" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <TableSkeleton cols={4} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="Aucune entrée" text="Aucune activité ne correspond à ces filtres." />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Utilisateur</Th>
                <Th>Action</Th>
                <Th>Objet</Th>
                <Th>IP</Th>
              </tr>
            </thead>
            <tbody data-testid="audit-rows">
              {(data ?? []).map((a) => (
                <tr key={a.id} className="border-t border-ip-line align-top">
                  <Td className="whitespace-nowrap">{dateFr(a.createdAt, true)}</Td>
                  <Td>{a.actor?.name ?? "Système"}</Td>
                  <Td>
                    <span className="font-semibold">{AUDIT_ACTION_LABELS[a.action] ?? a.action}</span>
                    {a.metadata && Object.keys(a.metadata).length > 0 && <span className="block max-w-xs truncate text-xs text-ip-muted">{JSON.stringify(a.metadata)}</span>}
                  </Td>
                  <Td>
                    {a.entityType}
                    {a.entityId && <span className="block text-xs text-ip-muted">{a.entityId.slice(0, 12)}</span>}
                  </Td>
                  <Td className="text-xs text-ip-muted">{a.ipAddress ?? "—"}</Td>
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
