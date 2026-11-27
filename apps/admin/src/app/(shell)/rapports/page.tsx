"use client";

import { Download } from "lucide-react";
import * as React from "react";
import { Gate } from "@/components/gate";
import { Input } from "@/components/ui/field";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, TableWrap, Td, Th } from "@/components/ui/kit";
import { money } from "@/lib/format";
import { useFetch } from "@/lib/hooks";
import type { AgingRow, RevenueRow } from "@/lib/types";

export default function ReportsPage() {
  return (
    <Gate perm="reports.read">
      <Inner />
    </Gate>
  );
}

function monthStart(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 10);
}

function Inner() {
  const [from, setFrom] = React.useState(monthStart(-11));
  const [to, setTo] = React.useState(new Date().toISOString().slice(0, 10));
  const rev = useFetch<RevenueRow[]>("/admin/reports/revenue", { from, to, groupBy: "month" });
  const aging = useFetch<AgingRow[]>("/admin/reports/aging");
  const currencies = Array.from(new Set((rev.data ?? []).map((r) => r.currency)));

  return (
    <>
      <PageHeader
        title="Rapports"
        subtitle="Facturé et encaissé par mois, créances par ancienneté."
        actions={
          <a href={`/api/v1/admin/documents/export.csv?type=INVOICE&from=${from}&to=${to}`} data-testid="export-csv" className="inline-flex h-9 items-center gap-2 rounded-xl border-2 border-ip-teal px-3 text-sm font-semibold text-ip-teal hover:bg-ip-teal hover:text-white">
            <Download className="size-4" aria-hidden="true" /> Export CSV des factures
          </a>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">
          Du
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
        </label>
        <label className="text-sm font-medium">
          Au
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
        </label>
      </div>

      <div className="space-y-5">
        {rev.error ? (
          <ErrorState message={rev.error.message} onRetry={rev.reload} />
        ) : rev.loading && !rev.data ? (
          <Skeleton className="h-64" />
        ) : currencies.length === 0 ? (
          <EmptyState title="Aucune donnée sur la période" text="Les montants apparaîtront dès que des factures seront émises ou payées." />
        ) : (
          currencies.map((cur) => <RevenueChart key={cur} currency={cur} rows={(rev.data ?? []).filter((r) => r.currency === cur)} />)
        )}

        <Card>
          <h2 className="mb-3 font-heading text-lg font-bold">Créances par ancienneté</h2>
          {aging.error ? (
            <ErrorState message={aging.error.message} onRetry={aging.reload} />
          ) : aging.loading && !aging.data ? (
            <Skeleton className="h-24" />
          ) : (aging.data ?? []).length === 0 ? (
            <p className="text-sm text-ip-muted">Aucune créance en cours.</p>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Devise</Th>
                  <Th className="text-right">Non échu</Th>
                  <Th className="text-right">1–30 j</Th>
                  <Th className="text-right">31–60 j</Th>
                  <Th className="text-right">61 j +</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody data-testid="aging-rows">
                {(aging.data ?? []).map((a) => (
                  <tr key={a.currency} className="border-t border-ip-line">
                    <Td className="font-semibold">{a.currency}</Td>
                    <Td className="text-right tabular-nums">{money(a.current, a.currency)}</Td>
                    <Td className="text-right tabular-nums">{money(a.d1_30, a.currency)}</Td>
                    <Td className="text-right tabular-nums">{money(a.d31_60, a.currency)}</Td>
                    <Td className="text-right tabular-nums text-red-700">{money(a.d61_plus, a.currency)}</Td>
                    <Td className="text-right font-semibold tabular-nums">{money(a.total, a.currency)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
    </>
  );
}

function RevenueChart({ currency, rows }: { currency: string; rows: RevenueRow[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => [Number(r.invoiced), Number(r.paid)]));
  const totalInv = rows.reduce((s, r) => s + Number(r.invoiced), 0);
  const totalPaid = rows.reduce((s, r) => s + Number(r.paid), 0);
  return (
    <Card data-testid={`revenue-${currency}`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-bold">Revenus par mois ({currency})</h2>
        <p className="text-sm text-ip-muted">
          Facturé <strong className="text-ip-ink">{money(totalInv, currency)}</strong> · Encaissé <strong className="text-ip-ink">{money(totalPaid, currency)}</strong>
        </p>
      </div>
      <div className="flex items-end gap-2 overflow-x-auto pb-2" role="img" aria-label={`Graphique des revenus mensuels en ${currency}`}>
        {rows.map((r) => (
          <div key={r.period} className="flex min-w-12 flex-1 flex-col items-center gap-1">
            <div className="flex h-44 items-end gap-1">
              <div className="w-4 rounded-t bg-ip-cyan" style={{ height: `${(Number(r.invoiced) / max) * 100}%` }} title={`Facturé ${money(r.invoiced, currency)}`} />
              <div className="w-4 rounded-t bg-ip-teal" style={{ height: `${(Number(r.paid) / max) * 100}%` }} title={`Encaissé ${money(r.paid, currency)}`} />
            </div>
            <span className="text-xs text-ip-muted">{r.period.slice(2)}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 flex gap-4 text-xs text-ip-muted">
        <span className="inline-flex items-center gap-1">
          <span className="size-3 rounded bg-ip-cyan" aria-hidden="true" /> Facturé
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-3 rounded bg-ip-teal" aria-hidden="true" /> Encaissé
        </span>
      </p>
    </Card>
  );
}
