"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Gate } from "@/components/gate";
import { Input, Select } from "@/components/ui/field";
import { Badge, EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton, TableWrap, Td, Th } from "@/components/ui/kit";
import { money } from "@/lib/format";
import { useDebounced, useFetch } from "@/lib/hooks";
import type { AdminProduct } from "@/lib/types";

const PRODUCT_STATUS = {
  ACTIVE: { label: "Actif", tone: "green" },
  DRAFT: { label: "Brouillon", tone: "sun" },
  ARCHIVED: { label: "Archivé", tone: "gray" },
} as const;

export default function ProductsPage() {
  return (
    <Gate perm="products.read">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [page, setPage] = React.useState(1);
  const dq = useDebounced(q);
  React.useEffect(() => setPage(1), [dq, status]);
  const { data, meta, loading, error, reload } = useFetch<AdminProduct[]>("/admin/products", { q: dq, status, page, pageSize: 25 });

  return (
    <>
      <PageHeader title="Produits & prix" subtitle="Prix de base, paliers de quantité et statut de chaque produit." />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ip-muted" aria-hidden="true" />
          <Input aria-label="Rechercher un produit" placeholder="Nom du produit…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="products-search" />
        </div>
        <Select aria-label="Filtrer par statut" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="DRAFT">Brouillon</option>
          <option value="ARCHIVED">Archivé</option>
        </Select>
      </div>
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <TableSkeleton cols={5} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="Aucun produit" text="Modifiez votre recherche." />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>Produit</Th>
                <Th>Catégorie</Th>
                <Th className="text-right">Prix de base</Th>
                <Th className="text-right">Qté min.</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody data-testid="products-rows">
              {(data ?? []).map((p) => (
                <tr key={p.id} className="border-t border-ip-line hover:bg-ip-mist/60">
                  <Td>
                    <Link href={`/produits/${p.id}`} className="font-semibold text-ip-teal hover:underline">
                      {p.name}
                    </Link>
                    <span className="block text-xs text-ip-muted">{p.slug}</span>
                  </Td>
                  <Td>{p.category.name}</Td>
                  <Td className="text-right tabular-nums">{money(p.basePrice, p.currency)}</Td>
                  <Td className="text-right tabular-nums">{p.minQty}</Td>
                  <Td>
                    <Badge tone={PRODUCT_STATUS[p.status].tone}>{PRODUCT_STATUS[p.status].label}</Badge>
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
