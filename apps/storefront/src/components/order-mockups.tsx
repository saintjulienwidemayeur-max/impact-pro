"use client";

import * as React from "react";
import { DesignPreview } from "./studio/design-preview";
import { FinalPreviewDialog } from "./studio/final-preview-dialog";
import { previewFor } from "@/config/product-media";
import { placementLabels, resolveApiUrl, type CustomOrderItem, type Placement } from "@/lib/api";
import { fromOrderElements } from "@/lib/design";
import { zonesWithElements } from "@/lib/mockup";

/**
 * Mock-ups of an ordered item, one per zone. Prefers the PNG our API stored at checkout (what the team sees);
 * otherwise renders the stored design with the same renderer as the studio.
 */
export function OrderMockups({ item }: { item: CustomOrderItem }) {
  const elements = React.useMemo(() => fromOrderElements(item.elements ?? []), [item.elements]);
  const [finalOpen, setFinalOpen] = React.useState(false);
  const zones = zonesWithElements(elements);
  const stored = new Map<Placement, string>((item.previews ?? []).map((p) => [p.placement, p.url]));
  if (!zones.length && !stored.size) return null;
  const list: Placement[] = zones.length ? zones : [...stored.keys()];
  return (
    <div className="mb-2" data-testid="order-mockups">
      <div className="flex flex-wrap gap-2">
        {list.slice(0, 4).map((z) => {
          const url = stored.get(z);
          return (
            <figure key={z} className="w-24 overflow-hidden rounded-xl border border-ip-line bg-white" data-testid="order-mockup" data-source={url ? "server" : "client"}>
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveApiUrl(url)} alt={`Aperçu : ${placementLabels[z] ?? z}`} className="block h-auto w-full" loading="lazy" />
              ) : (
                <DesignPreview preview={previewFor(item.productSlug, z, item.color ?? undefined, item.size ?? undefined)} elements={elements.filter((e) => e.placement === z)} sizes="96px" compact />
              )}
              {list.length > 1 && <figcaption className="bg-ip-mist px-1 py-0.5 text-center text-[10px] font-semibold text-ip-teal">{placementLabels[z] ?? z}</figcaption>}
            </figure>
          );
        })}
      </div>
      {elements.length > 0 && (
        <button type="button" onClick={() => setFinalOpen(true)} className="mt-1.5 text-xs font-semibold text-ip-teal hover:underline" data-testid="order-final-open">
          Voir le rendu final
        </button>
      )}
      {finalOpen && <FinalPreviewDialog productName={item.productName} productSlug={item.productSlug} color={item.color ?? undefined} size={item.size ?? undefined} elements={elements} onClose={() => setFinalOpen(false)} />}
    </div>
  );
}
