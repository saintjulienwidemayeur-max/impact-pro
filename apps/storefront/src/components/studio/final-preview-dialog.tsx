"use client";

import * as React from "react";
import { Download, Loader2, Pencil, X } from "lucide-react";
import { DesignPreview } from "./design-preview";
import { Button } from "../ui/button";
import { previewFor } from "@/config/product-media";
import { placementLabels } from "@/lib/api";
import type { DesignElement } from "@/lib/design";
import { downloadMockupSheet, zonesWithElements } from "@/lib/mockup";

interface Props {
  productName: string;
  productSlug: string;
  color?: string;
  size?: string;
  elements: DesignElement[];
  onClose: () => void;
}

/**
 * « Voir le rendu final »: every zone of the design rendered large, without handles or selection,
 * exactly as the customer will see it in the cart and in the mock-up we send back.
 */
export function FinalPreviewDialog({ productName, productSlug, color, size, elements, onClose }: Props) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const zones = zonesWithElements(elements);

  React.useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  async function download() {
    setBusy(true);
    setNote(null);
    try {
      const ok = await downloadMockupSheet({ productName, slug: productSlug, color, size, elements });
      if (!ok) setNote("Le téléchargement n'est pas disponible pour ce design (un de vos fichiers ne peut pas être exporté). Faites une capture d'écran de l'aperçu.");
    } catch {
      setNote("Le téléchargement a échoué. Faites une capture d'écran de l'aperçu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="final-title"
      data-testid="final-preview"
      className="m-auto max-h-[94vh] w-[min(1100px,96vw)] overflow-y-auto rounded-3xl border-0 p-0 shadow-2xl backdrop:bg-ip-ink/60"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-ip-line bg-white px-5 py-4 sm:px-7">
        <div>
          <h2 id="final-title" className="text-xl font-bold sm:text-2xl">
            Voici votre produit terminé
          </h2>
          <p className="mt-0.5 text-sm text-ip-muted">
            {productName}
            {color ? ` · ${color}` : ""} — aperçu indicatif ; la maquette définitive vous est envoyée avant production.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer" className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-ip-muted hover:bg-ip-mist">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className={zones.length > 1 ? "grid gap-5 p-5 sm:grid-cols-2 sm:p-7" : "mx-auto max-w-2xl p-5 sm:p-7"}>
        {zones.map((z) => {
          const pv = previewFor(productSlug, z, color, size);
          return (
            <figure key={z} className="overflow-hidden rounded-2xl border border-ip-line bg-white" data-testid="final-zone">
              <figcaption className="border-b border-ip-line bg-ip-mist px-4 py-2 text-sm font-semibold text-ip-teal">
                {placementLabels[z] ?? z}
                {pv.indicative && !pv.photo.plain && <span className="ml-2 font-normal text-ip-muted">· emplacement indicatif</span>}
              </figcaption>
              <DesignPreview preview={pv} elements={elements.filter((e) => e.placement === z)} compact sizes="(min-width: 1024px) 520px, 90vw" />
            </figure>
          );
        })}
      </div>

      {note && (
        <p role="status" className="mx-5 mb-3 rounded-xl bg-ip-sun/20 p-3 text-sm sm:mx-7">
          {note}
        </p>
      )}
      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-ip-line bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
        <Button type="button" variant="outline" onClick={onClose} data-testid="final-back">
          <Pencil aria-hidden="true" /> Revenir à l&apos;édition
        </Button>
        <Button type="button" variant="sun" onClick={download} disabled={busy} data-testid="final-download">
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
          Télécharger l&apos;aperçu (PNG)
        </Button>
      </div>
    </dialog>
  );
}
