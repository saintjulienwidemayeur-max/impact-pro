import Link from "next/link";
import { Check, FileText, Type } from "lucide-react";
import { orderStatusLabels, placementLabels, resolveApiUrl, type CustomOrder, type CustomOrderElement, type CustomOrderItem, type CustomOrderStatus } from "@/lib/api";
import { describeOptions, fontById } from "@/lib/design";
import { OrderMockups } from "./order-mockups";
import { toNumber } from "@/lib/pricing";
import { SHOW_PRICES } from "@/config/pricing-display";
import { cn, formatHTG } from "@/lib/utils";

const flow: CustomOrderStatus[] = ["RECEIVED", "MOCKUP_SENT", "APPROVED", "IN_PRODUCTION", "READY", "DELIVERED"];

export const nextSteps = [
  "Nous vous envoyons la maquette et la proforma sous 24 h",
  "Vous validez",
  "Proforma, puis paiement par carte, Zelle ou virement",
  "Production & livraison",
];

export function OrderStatusTimeline({ status }: { status: CustomOrderStatus }) {
  if (status === "CANCELLED") {
    return <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">Cette commande a été annulée.</p>;
  }
  const current = flow.indexOf(status);
  return (
    <ol className="grid gap-2 sm:grid-cols-6" aria-label="Avancement de la commande">
      {flow.map((s, i) => (
        <li key={s} className="flex items-center gap-2 sm:flex-col sm:text-center" aria-current={i === current ? "step" : undefined}>
          <span
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
              i < current && "border-ip-teal bg-ip-teal text-white",
              i === current && "border-ip-teal bg-ip-sun text-ip-ink",
              i > current && "border-ip-line bg-white text-ip-muted",
            )}
          >
            {i < current ? <Check className="size-4" aria-hidden="true" /> : i + 1}
          </span>
          <span className={cn("text-xs", i === current ? "font-semibold text-ip-ink" : "text-ip-muted")}>{orderStatusLabels[s]}</span>
        </li>
      ))}
    </ol>
  );
}

/** Elements grouped per print zone (falls back to the legacy single logo of older orders). */
function zonesOf(it: CustomOrderItem): { placement: string; elements: CustomOrderElement[] }[] {
  const els = it.elements?.length
    ? it.elements
    : it.logoUrl
      ? [{ placement: it.placement ?? "FRONT", kind: "LOGO" as const, x: 0, y: 0, scale: 1, rotation: 0, sort: 0, logoUrl: it.logoUrl, originalName: null }]
      : [];
  const order: string[] = [];
  for (const e of [...els].sort((a, b) => a.sort - b.sort)) if (!order.includes(e.placement)) order.push(e.placement);
  return order.map((placement) => ({ placement, elements: els.filter((e) => e.placement === placement).sort((a, b) => a.sort - b.sort) }));
}

export function ItemDesign({ item }: { item: CustomOrderItem }) {
  const zones = zonesOf(item);
  if (!zones.length) return <span className="text-xs text-ip-muted">—</span>;
  return (
    <ul className="space-y-2" data-testid="order-design">
      {zones.map((z) => (
        <li key={z.placement} className="text-xs">
          <p className="font-semibold text-ip-ink">{placementLabels[z.placement as keyof typeof placementLabels] ?? z.placement}</p>
          <ul className="mt-0.5 space-y-1">
            {z.elements.map((e, i) =>
              e.kind === "TEXT" ? (
                <li key={i} className="flex items-start gap-1.5 text-ip-muted">
                  <Type className="mt-0.5 size-3.5 shrink-0 text-ip-teal" aria-hidden="true" />
                  <span>
                    <span className="whitespace-pre-line font-medium text-ip-ink">« {e.text} »</span>
                    <span className="block">
                      {fontById(e.font ?? undefined).label}
                      {e.fontWeight === "bold" ? " gras" : ""} · {e.color}
                    </span>
                  </span>
                </li>
              ) : (
                <li key={i} className="flex items-center gap-1.5">
                  {e.logoUrl && !/\.pdf$/i.test(e.originalName ?? "") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveApiUrl(e.logoUrl)} crossOrigin="anonymous" alt="" className="size-8 shrink-0 rounded border border-ip-line bg-white object-contain" />
                  ) : (
                    <FileText className="size-4 shrink-0 text-ip-teal" aria-hidden="true" />
                  )}
                  {e.logoUrl ? (
                    <a href={resolveApiUrl(e.logoUrl)} target="_blank" rel="noopener noreferrer" className="font-semibold text-ip-teal hover:underline">
                      {e.kind === "ARTWORK" ? "Fichier prêt à imprimer" : "Logo"}
                      {e.originalName ? ` · ${e.originalName}` : ""}
                    </a>
                  ) : (
                    <span>{e.kind === "ARTWORK" ? "Fichier prêt à imprimer" : "Logo"}</span>
                  )}
                </li>
              ),
            )}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function OrderDetails({ order, labels = {} }: { order: CustomOrder; labels?: Record<string, { colorLabel?: string; sizeLabel?: string }> }) {
  const created = order.createdAt ? new Date(order.createdAt) : null;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-ip-muted">Référence</p>
          <p className="font-heading text-2xl font-bold text-ip-teal" data-testid="order-ref">
            {order.reference}
          </p>
          {created && (
            <p className="text-xs text-ip-muted">
              Passée le {created.toLocaleDateString("fr-HT", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
        </div>
        <span className="rounded-full bg-ip-teal px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">{orderStatusLabels[order.status] ?? order.status}</span>
      </div>
      <OrderStatusTimeline status={order.status} />
      <div className="overflow-x-auto rounded-2xl border border-ip-line">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-ip-mist text-left text-xs uppercase tracking-wide text-ip-muted">
            <tr>
              <th scope="col" className="px-4 py-2 font-semibold">Article</th>
              <th scope="col" className="px-4 py-2 font-semibold">Design</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Qté</th>
              {SHOW_PRICES && <th scope="col" className="px-4 py-2 text-right font-semibold">Prix unitaire</th>}
              {SHOW_PRICES && <th scope="col" className="px-4 py-2 text-right font-semibold">Total</th>}
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr key={`${it.productSlug}-${i}`} className="border-t border-ip-line">
                <td className="px-4 py-3">
                  <Link href={`/produits/${it.productSlug}`} className="font-semibold hover:text-ip-teal">
                    {it.productName}
                  </Link>
                  <p className="text-xs text-ip-muted" data-testid="order-options">
                    {describeOptions({ color: it.color, size: it.size, widthCm: it.widthCm, heightCm: it.heightCm, ...labels[it.productSlug] }).join(" · ")}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <OrderMockups item={it} />
                  <ItemDesign item={it} />
                </td>
                <td className="px-4 py-3 text-right">{it.quantity}</td>
                {SHOW_PRICES && <td className="px-4 py-3 text-right">{formatHTG(toNumber(it.unitPrice))}</td>}
                {SHOW_PRICES && <td className="px-4 py-3 text-right font-semibold">{formatHTG(toNumber(it.lineTotal))}</td>}
              </tr>
            ))}
          </tbody>
          {SHOW_PRICES && <tfoot>
            <tr className="border-t-2 border-ip-line">
              <th scope="row" colSpan={4} className="px-4 py-3 text-right font-semibold">
                Sous-total
              </th>
              <td className="px-4 py-3 text-right text-base font-bold" data-testid="order-subtotal">
                {formatHTG(toNumber(order.subtotal))}
              </td>
            </tr>
          </tfoot>}
        </table>
      </div>
      <p className="text-xs text-ip-muted">{SHOW_PRICES ? `Montants en ${order.currency}. ` : "Le montant vous est communiqué dans votre proforma. "}Frais de livraison éventuels confirmés avec la maquette.</p>
    </div>
  );
}
