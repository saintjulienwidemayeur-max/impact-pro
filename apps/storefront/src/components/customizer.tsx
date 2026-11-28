"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ArrowRight, Copy, Eye, FileText, ImageIcon, Minus, Plus, ShoppingCart, Trash2, Type } from "lucide-react";
import { useCart } from "./cart-provider";
import { Button } from "./ui/button";
import { Field, Textarea } from "./ui/field";
import { DesignPreview } from "./studio/design-preview";
import { FinalPreviewDialog } from "./studio/final-preview-dialog";
import { ElementEditor } from "./studio/element-editor";
import { ElementUploader } from "./studio/element-uploader";
import { isPhotoMode, previewFor, productPhotos } from "@/config/product-media";
import type { Placement, Product } from "@/lib/api";
import { resolveApiUrl } from "@/lib/api";
import {
  HEX_RE,
  MAX_ELEMENTS,
  areaM2,
  capsOf,
  estimateUnit,
  newId,
  newTextElement,
  newUploadElement,
  optionsOf,
  placementLabelsFr,
  type DesignElement,
  type UploadRef,
} from "@/lib/design";
import { ensureFonts, fitTextScale, loadImage } from "@/lib/design-render";
import { sortedTiers, toNumber } from "@/lib/pricing";
import { cn, formatHTG } from "@/lib/utils";

type Errors = Partial<Record<"design" | "color" | "size" | "quantity" | "dimensions", string>>;

function Chip({ selected, children, onClick, swatch }: { selected: boolean; children: React.ReactNode; onClick: () => void; swatch?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-xl border-2 px-3 text-sm font-medium transition-colors",
        selected ? "border-ip-teal bg-ip-teal/5 text-ip-teal" : "border-ip-line bg-white hover:border-ip-teal/60",
      )}
    >
      {swatch && <span className="size-4 rounded-full border border-black/10" style={{ background: swatch }} aria-hidden="true" />}
      {children}
    </button>
  );
}

const swatches: [RegExp, string][] = [
  [/teal/i, "#0A716A"],
  [/blanc/i, "#ffffff"],
  [/noir/i, "#111111"],
  [/jaune|soleil/i, "#FFC93C"],
  [/cyan|bleu ciel/i, "#42C6F0"],
  [/bleu|marine/i, "#1f3b8a"],
  [/rouge/i, "#c62828"],
  [/gris/i, "#9aa5a8"],
  [/vert/i, "#2e7d32"],
  [/orange/i, "#e65100"],
  [/rose/i, "#e91e8c"],
];
const swatchFor = (color: string) => swatches.find(([re]) => re.test(color))?.[1];

const roundTo5 = (n: number) => Math.round(n / 5) * 5;

function elementLabel(el: DesignElement): string {
  if (el.kind === "TEXT") return (el.text ?? "").replace(/\s+/g, " ").trim() || "Texte vide";
  return el.upload?.originalName ?? (el.kind === "ARTWORK" ? "Fichier" : "Logo");
}

/** Studio de personnalisation: zones, elements (logos / texts / artwork), options, quantity, estimate. */
export function Customizer({ product }: { product: Product }) {
  const router = useRouter();
  const { add } = useCart();
  const caps = React.useMemo(() => capsOf(product), [product]);
  // Only the parameters this product really has (a ball has no size, a phone case asks for the model…).
  const options = React.useMemo(() => optionsOf({ ...product, customSize: capsOf(product).customSize }), [product]);
  const tiers = sortedTiers(product.priceTiers);
  const gallery = productPhotos(product);
  const perArea = caps.pricingMode === "PER_AREA";
  const unitLabel = perArea ? "m²" : product.unitLabel;

  const [elements, setElements] = React.useState<DesignElement[]>([]);
  const [zone, setZone] = React.useState<Placement>(caps.zones[0].placement);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [color, setColor] = React.useState<string | undefined>(options.color?.required !== false ? options.color?.values[0] : undefined);
  // The standard (first) size is pre-selected when the product has a short list of sizes (roll-up, tent, bottle…).
  const [size, setSize] = React.useState<string | undefined>(product.sizes.length > 0 && product.sizes.length <= 4 && product.sizesRequired !== false && !product.customSize ? product.sizes[0] : undefined);
  const [qtyInput, setQtyInput] = React.useState(String(product.minQty));
  const [wInput, setWInput] = React.useState(String(caps.customSize?.defaultWidthCm ?? ""));
  const [hInput, setHInput] = React.useState(String(caps.customSize?.defaultHeightCm ?? ""));
  const [notes, setNotes] = React.useState("");
  const [view, setView] = React.useState<"studio" | number>("studio");
  const [errors, setErrors] = React.useState<Errors>({});
  const [coverScale, setCoverScale] = React.useState<number | null>(null);
  const [finalOpen, setFinalOpen] = React.useState(false);

  const zoneDef = caps.zones.find((z) => z.placement === zone) ?? caps.zones[0];
  const zoneElements = elements.filter((e) => e.placement === zone);
  const selected = zoneElements.find((e) => e.id === selectedId) ?? null;
  const preview = previewFor(product.slug, zone, color, size);
  // phone cases: the customer sends a photo that fills the whole back of the case
  const photoMode = isPhotoMode(product.slug);

  const qty = Number.parseInt(qtyInput, 10);
  const validQty = Number.isInteger(qty) && qty >= product.minQty && qty <= 100_000;
  const cs = caps.customSize;
  const widthCm = Number.parseFloat(wInput);
  const heightCm = Number.parseFloat(hInput);
  const dimsValid = !cs || (Number.isFinite(widthCm) && Number.isFinite(heightCm) && widthCm >= cs.minWidthCm && widthCm <= cs.maxWidthCm && heightCm >= cs.minHeightCm && heightCm <= cs.maxHeightCm);
  const priceInput = {
    quantity: validQty ? qty : product.minQty,
    basePrice: product.basePrice,
    priceTiers: tiers,
    pricingMode: caps.pricingMode,
    customSize: cs,
    widthCm: dimsValid ? widthCm : cs?.defaultWidthCm,
    heightCm: dimsValid ? heightCm : cs?.defaultHeightCm,
  };
  const unit = estimateUnit(priceInput);
  const area = areaM2(priceInput);

  // cover scale of the selected artwork (image aspect vs. print-area aspect)
  React.useEffect(() => {
    let alive = true;
    setCoverScale(null);
    const u = selected?.kind === "ARTWORK" || (photoMode && selected?.kind === "LOGO") ? selected.upload : null;
    if (!u || !u.mimeType.startsWith("image/")) return;
    loadImage(resolveApiUrl(u.url))
      .then((img) => {
        if (!alive) return;
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const areaAspect = preview.area.w / preview.area.h;
        setCoverScale(Math.max(areaAspect / imgAspect, imgAspect / areaAspect));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [selected?.id, selected?.kind, selected?.upload, photoMode, preview.area.w, preview.area.h]);

  // selection follows the zone
  React.useEffect(() => {
    setSelectedId((id) => (id && zoneElements.some((e) => e.id === id) ? id : (zoneElements[zoneElements.length - 1]?.id ?? null)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, elements.length]);

  // A manual resize ends the automatic fitting of a text.
  const patch = React.useCallback(
    (id: string, p: Partial<DesignElement>) => setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...p, ...("scale" in p ? { autoFit: false } : {}) } : e))),
    [],
  );

  /** Editor changes: a text that was never resized by hand keeps fitting the print area as it is typed. */
  function editorChange(el: DesignElement, p: Partial<DesignElement>) {
    patch(el.id, p);
    if (el.kind === "TEXT" && el.autoFit !== false && !("scale" in p) && ("text" in p || "font" in p || "fontWeight" in p)) {
      const merged = { ...el, ...p };
      const area = preview.area;
      void ensureFonts([merged]).then(() => {
        const s = fitTextScale(merged, area);
        setElements((prev) => prev.map((e) => (e.id === el.id && e.autoFit !== false ? { ...e, scale: s } : e)));
      });
    }
  }

  async function addText() {
    const el = newTextElement(zone);
    await ensureFonts([el]);
    addElement({ ...el, scale: fitTextScale(el, preview.area) });
  }

  function addElement(el: DesignElement) {
    if (elements.length >= MAX_ELEMENTS || zoneElements.length >= zoneDef.maxElements) {
      setErrors((e) => ({ ...e, design: `Maximum ${zoneDef.maxElements} éléments par emplacement.` }));
      return;
    }
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
    setView("studio");
    setErrors((e) => ({ ...e, design: undefined }));
  }

  function removeElement(id: string) {
    setElements((prev) => prev.filter((e) => e.id !== id));
    setSelectedId(null);
  }

  function duplicateElement(el: DesignElement) {
    addElement({ ...el, id: newId(), x: Math.min(0.5, el.x + 0.05), y: Math.min(0.5, el.y + 0.05) });
  }

  function moveLayer(id: string, dir: -1 | 1) {
    setElements((prev) => {
      const i = prev.findIndex((e) => e.id === id);
      if (i < 0) return prev;
      const siblings = prev.map((e, idx) => ({ e, idx })).filter((s) => s.e.placement === prev[i].placement);
      const pos = siblings.findIndex((s) => s.idx === i);
      const target = siblings[pos + dir];
      if (!target) return prev;
      const next = [...prev];
      [next[i], next[target.idx]] = [next[target.idx], next[i]];
      return next;
    });
  }

  function onUploaded(kind: "LOGO" | "ARTWORK", upload: UploadRef) {
    const el = newUploadElement(zone, kind, upload);
    if (photoMode && kind === "LOGO" && upload.mimeType.startsWith("image/")) {
      // photo mode: the photo fills the whole print area (« Remplir »); « Ajuster » stays available in the editor
      const areaAspect = preview.area.w / preview.area.h;
      loadImage(resolveApiUrl(upload.url))
        .then((img) => {
          const a = img.naturalWidth / img.naturalHeight;
          addElement({ ...el, scale: Math.min(4, Math.max(areaAspect / a, a / areaAspect)) });
        })
        .catch(() => addElement({ ...el, scale: 1 }));
      return;
    }
    addElement(el);
  }

  function validate(): boolean {
    const next: Errors = {};
    if (elements.length === 0) next.design = caps.artworkRequired ? "Importez votre fichier prêt à imprimer pour continuer." : "Ajoutez un logo, un texte ou votre fichier pour continuer.";
    else if (caps.artworkRequired && !elements.some((e) => e.kind === "ARTWORK")) next.design = "Ce produit nécessite votre fichier prêt à imprimer : importez-le pour continuer.";
    else if (elements.some((e) => e.kind === "TEXT" && !(e.text ?? "").trim())) next.design = "Un de vos textes est vide : écrivez-le ou supprimez-le.";
    else if (elements.some((e) => e.kind === "TEXT" && e.color && !HEX_RE.test(e.color))) next.design = "Une couleur de texte est invalide.";
    if (options.color?.required && !color) next.color = `Veuillez choisir : ${options.color.label.toLowerCase()}.`;
    if (options.size?.required && !size) next.size = `Veuillez choisir : ${options.size.label.toLowerCase()}.`;
    if (!validQty) next.quantity = `Quantité minimale : ${product.minQty} ${product.unitLabel}.`;
    if (cs && !dimsValid) next.dimensions = `Largeur ${cs.minWidthCm}–${cs.maxWidthCm} cm, hauteur ${cs.minHeightCm}–${cs.maxHeightCm} cm.`;
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) document.getElementById(`cz-${first}`)?.focus();
    return !first;
  }

  function addToCart(goToCheckout: boolean) {
    if (!validate()) return;
    add({
      productSlug: product.slug,
      productName: product.name,
      unitLabel: product.unitLabel,
      minQty: product.minQty,
      basePrice: product.basePrice,
      priceTiers: tiers,
      pricingMode: caps.pricingMode,
      customSize: cs,
      quantity: qty,
      color: options.color ? color : undefined,
      size: options.size ? size : undefined,
      colorLabel: options.color?.label,
      sizeLabel: options.size?.label,
      widthCm: cs ? widthCm : undefined,
      heightCm: cs ? heightCm : undefined,
      elements,
      notes: notes.trim() || undefined,
    });
    if (goToCheckout) router.push("/commande");
  }

  const quickSizes = React.useMemo(() => {
    if (!cs) return [];
    // Product sizes such as « 3 × 1,2 m » become quick-pick dimensions when they fit the allowed range.
    const parsed = product.sizes
      .map((label) => {
        const m = /^\s*(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*(m|cm)\s*$/i.exec(label);
        if (!m) return null;
        const f = m[3].toLowerCase() === "m" ? 100 : 1;
        return { w: Math.round(Number(m[1].replace(",", ".")) * f), h: Math.round(Number(m[2].replace(",", ".")) * f) };
      })
      .filter((s): s is { w: number; h: number } => Boolean(s) && s!.w >= cs.minWidthCm && s!.w <= cs.maxWidthCm && s!.h >= cs.minHeightCm && s!.h <= cs.maxHeightCm);
    if (parsed.length) return parsed;
    const mid = (a: number, b: number, t: number) => roundTo5(a + (b - a) * t);
    const all = [
      { w: cs.defaultWidthCm, h: cs.defaultHeightCm },
      { w: cs.minWidthCm, h: cs.minHeightCm },
      { w: mid(cs.minWidthCm, cs.maxWidthCm, 0.4), h: mid(cs.minHeightCm, cs.maxHeightCm, 0.4) },
      { w: cs.maxWidthCm, h: cs.maxHeightCm },
    ];
    return all.filter((s, i) => all.findIndex((o) => o.w === s.w && o.h === s.h) === i);
  }, [cs, product.sizes]);

  const hasOptions = Boolean(options.color || options.size || cs);
  const showStudio = view === "studio";
  const mainPhoto = typeof view === "number" ? gallery[view] : null;
  const canAddLogo = caps.supportsLogo;
  const canAddText = caps.supportsText;
  const canAddArtwork = caps.supportsArtwork;
  const zoneCount = (p: Placement) => elements.filter((e) => e.placement === p).length;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
      {/* ---------- Visual ---------- */}
      {/* Desktop: the whole column is sticky. Phone: the column dissolves (`contents`) so that the zone tabs + live preview
          stay pinned at the top (and the notes/gallery scroll away) while the customer edits below. */}
      <div className="lg:sticky lg:top-28 lg:self-start max-lg:contents">
        <div className="max-lg:sticky max-lg:top-[60px] max-lg:z-30 max-lg:-mx-4 max-lg:bg-white max-lg:px-4 max-lg:pb-2 max-lg:pt-2 max-lg:shadow-[0_6px_10px_-8px_rgba(14,42,46,0.35)]">
        {caps.zones.length > 1 && (
          <div role="tablist" aria-label="Emplacements de personnalisation" className="mb-2 flex gap-2 overflow-x-auto pb-1 lg:mb-3 lg:flex-wrap" data-testid="zone-tabs">
            {caps.zones.map((z) => {
              const n = zoneCount(z.placement);
              return (
                <button
                  key={z.placement}
                  type="button"
                  role="tab"
                  aria-selected={zone === z.placement}
                  onClick={() => {
                    setZone(z.placement);
                    setView("studio");
                  }}
                  data-testid={`zone-${z.placement}`}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border-2 px-3 text-sm font-semibold transition-colors",
                    zone === z.placement ? "border-ip-teal bg-ip-teal text-white" : "border-ip-line bg-white hover:border-ip-teal/60",
                  )}
                >
                  {z.label || placementLabelsFr[z.placement]}
                  {n > 0 && <span className={cn("inline-flex size-5 items-center justify-center rounded-full text-[11px]", zone === z.placement ? "bg-white text-ip-teal" : "bg-ip-sun text-ip-ink")}>{n}</span>}
                </button>
              );
            })}
          </div>
        )}

        <div
          className="mx-auto overflow-hidden rounded-[1.5rem] border border-ip-line bg-white max-lg:max-w-[min(100%,calc(36vh*var(--ar)))] lg:!max-w-none"
          style={{ "--ar": preview.photo.width / preview.photo.height } as React.CSSProperties}
        >
          {showStudio ? (
            <DesignPreview
              preview={preview}
              elements={zoneElements}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={patch}
              zoneLabel={placementLabelsFr[zone]}
              priority
            />
          ) : mainPhoto ? (
            <div className="relative w-full bg-white" style={{ aspectRatio: `${mainPhoto.width} / ${mainPhoto.height}` }}>
              <Image src={mainPhoto.src} alt={mainPhoto.alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-contain" />
            </div>
          ) : null}
        </div>
        </div>
        {elements.length > 0 && (
          <div className="mt-3 flex justify-center">
            <Button type="button" variant="outline" onClick={() => setFinalOpen(true)} data-testid="final-open">
              <Eye aria-hidden="true" /> Voir le rendu final
            </Button>
          </div>
        )}
        {preview.photo.plain && !gallery.length && (
          <p className="mt-2 rounded-xl bg-ip-mist p-3 text-xs text-ip-muted">Photo du produit à venir : l&apos;aperçu montre la zone d&apos;impression. Votre maquette finale vous sera envoyée avant production.</p>
        )}
        {preview.indicative && !preview.photo.plain && (
          <p className="mt-2 rounded-xl bg-ip-mist p-3 text-xs text-ip-muted" data-testid="indicative-note">
            Aperçu indicatif de l&apos;emplacement : {placementLabelsFr[zone]}. La vue exacte vous est présentée sur la maquette envoyée avant production.
          </p>
        )}
        {gallery.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Vues du produit">
            <button
              type="button"
              role="tab"
              aria-selected={showStudio}
              onClick={() => setView("studio")}
              className={cn("relative size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white", showStudio ? "border-ip-teal" : "border-ip-line")}
            >
              {preview.photo.plain ? <span className="absolute inset-0 bg-ip-mist" /> : <Image src={preview.photo.src} alt="" fill sizes="64px" className="object-cover" />}
              <span className="absolute inset-x-0 bottom-0 bg-ip-teal py-0.5 text-[9px] font-bold uppercase text-white">Aperçu</span>
            </button>
            {gallery.map((ph, i) => (
              <button
                key={ph.src}
                type="button"
                role="tab"
                aria-selected={view === i}
                aria-label={`Voir : ${ph.alt}`}
                onClick={() => setView(i)}
                className={cn("relative size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white", view === i ? "border-ip-teal" : "border-ip-line")}
              >
                <Image src={ph.src} alt="" fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Configuration ---------- */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-ip-teal">{product.category.name}</p>
        <h2 className="mt-1 text-3xl font-bold">{product.name}</h2>
        {product.description && <p className="mt-3 text-ip-muted">{product.description}</p>}

        <div className="mt-6 overflow-hidden rounded-2xl border border-ip-line">
          <table className="w-full text-sm">
            <caption className="bg-ip-mist px-4 py-2 text-left text-sm font-semibold">Prix dégressifs</caption>
            <thead>
              <tr className="border-b border-ip-line text-left text-xs uppercase tracking-wide text-ip-muted">
                <th scope="col" className="px-4 py-2 font-semibold">Quantité</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Prix / {unitLabel}</th>
              </tr>
            </thead>
            <tbody>
              {(tiers.length ? tiers : [{ minQty: product.minQty, unitPrice: product.basePrice }]).map((t, i, arr) => {
                const next = arr[i + 1];
                const active = validQty && qty >= t.minQty && (!next || qty < next.minQty);
                return (
                  <tr key={t.minQty} className={cn("border-b border-ip-line last:border-0", active && "bg-ip-sun/25 font-semibold")}>
                    <td className="px-4 py-2">{next ? `${t.minQty} – ${next.minQty - 1}` : `${t.minQty} et +`}</td>
                    <td className="px-4 py-2 text-right">{formatHTG(toNumber(t.unitPrice))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <form
          className="mt-8 space-y-8"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            addToCart(false);
          }}
        >
          {/* 1 · Design */}
          <section aria-labelledby="step-design">
            <h3 id="step-design" className="mb-1 flex items-center gap-2 text-lg font-semibold">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-ip-teal text-sm text-white">1</span> Votre design
            </h3>
            <p className="mb-3 text-sm text-ip-muted">
              Emplacement : <strong>{placementLabelsFr[zone]}</strong>
              {caps.zones.length > 1 && " — changez d'emplacement avec les onglets au-dessus de l'aperçu (ex. logo devant, texte au dos)."}
            </p>

            <div id="cz-design" tabIndex={-1} className="space-y-3 focus:outline-none">
              {caps.artworkRequired && canAddArtwork && (
                <div className="rounded-2xl border-2 border-ip-sun bg-ip-sun/10 p-3">
                  <p className="mb-2 text-sm font-semibold">Envoyez le fichier que vous voulez imprimer</p>
                  <ElementUploader kind="ARTWORK" primary onUploaded={(u) => onUploaded("ARTWORK", u)} />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {canAddLogo && <ElementUploader kind="LOGO" photoMode={photoMode} onUploaded={(u) => onUploaded("LOGO", u)} />}
                {canAddText && (
                  <div>
                    <Button type="button" variant="outline" onClick={() => void addText()} data-testid="add-text">
                      <Type aria-hidden="true" /> Ajouter du texte
                    </Button>
                    <p className="mt-1 text-[11px] text-ip-muted">8 polices, couleurs au choix.</p>
                  </div>
                )}
                {!caps.artworkRequired && canAddArtwork && (
                  <div className="sm:col-span-2">
                    <ElementUploader kind="ARTWORK" onUploaded={(u) => onUploaded("ARTWORK", u)} />
                  </div>
                )}
              </div>
              {errors.design && (
                <p className="text-xs text-red-700" role="alert">
                  {errors.design}
                </p>
              )}
            </div>

            {zoneElements.length > 0 && (
              <ul className="mt-4 space-y-1.5" aria-label={`Éléments de l'emplacement ${placementLabelsFr[zone]}`} data-testid="layer-list">
                {[...zoneElements].reverse().map((el) => (
                  <li key={el.id}>
                    <div className={cn("flex items-center gap-2 rounded-xl border-2 p-1.5", el.id === selectedId ? "border-ip-teal bg-ip-teal/5" : "border-ip-line bg-white")}>
                      <button type="button" onClick={() => setSelectedId(el.id)} aria-pressed={el.id === selectedId} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left" data-testid="layer-item">
                        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ip-line bg-white">
                          {el.kind === "TEXT" ? (
                            <Type className="size-4 text-ip-teal" aria-hidden="true" />
                          ) : el.upload?.mimeType.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={resolveApiUrl(el.upload.url)} crossOrigin="anonymous" alt="" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <FileText className="size-4 text-ip-teal" aria-hidden="true" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-ip-teal">{el.kind === "TEXT" ? "Texte" : el.kind === "ARTWORK" ? "Fichier" : "Logo"}</span>
                          <span className="block truncate text-sm">{elementLabel(el)}</span>
                        </span>
                      </button>
                      <button type="button" onClick={() => duplicateElement(el)} aria-label={`Dupliquer ${elementLabel(el)}`} className="inline-flex size-9 items-center justify-center rounded-lg text-ip-muted hover:bg-ip-mist">
                        <Copy className="size-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => removeElement(el.id)} aria-label={`Supprimer ${elementLabel(el)}`} className="inline-flex size-9 items-center justify-center rounded-lg text-ip-muted hover:bg-red-50 hover:text-red-700">
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {zoneElements.length === 0 && (
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-ip-mist p-3 text-xs text-ip-muted">
                <ImageIcon className="size-4 shrink-0 text-ip-teal" aria-hidden="true" /> Rien sur cet emplacement pour le moment.
              </p>
            )}

            {selected && (
              <div className="mt-4">
                <ElementEditor
                  element={selected}
                  coverScale={coverScale}
                  photoMode={photoMode}
                  canMoveUp={zoneElements[zoneElements.length - 1]?.id !== selected.id}
                  canMoveDown={zoneElements[0]?.id !== selected.id}
                  onChange={(p) => editorChange(selected, p)}
                  onDelete={() => removeElement(selected.id)}
                  onDuplicate={() => duplicateElement(selected)}
                  onMove={(dir) => moveLayer(selected.id, dir)}
                />
              </div>
            )}
          </section>

          {/* 2 · Options (only when the product has parameters) */}
          {hasOptions && (
            <section aria-labelledby="step-options">
              <h3 id="step-options" className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-ip-teal text-sm text-white">2</span> Options
              </h3>
              <div className="space-y-5" data-testid="options">
                {options.color && (
                  <div data-testid="option-color">
                    <p id="lbl-prodcolor" className="mb-2 text-sm font-medium">
                      {options.color.label}
                      {options.color.required && <span className="text-red-700"> *</span>}
                    </p>
                    <div role="radiogroup" aria-labelledby="lbl-prodcolor" id="cz-color" tabIndex={-1} className="flex flex-wrap gap-2">
                      {options.color.values.map((c) => (
                        <Chip
                          key={c}
                          selected={color === c}
                          swatch={swatchFor(c)}
                          onClick={() => {
                            setColor(color === c && !options.color?.required ? undefined : c);
                            setErrors((e) => ({ ...e, color: undefined }));
                          }}
                        >
                          {c}
                        </Chip>
                      ))}
                    </div>
                    {errors.color && <p className="mt-1 text-xs text-red-700" role="alert">{errors.color}</p>}
                  </div>
                )}
                {options.size && (
                  <div data-testid="option-size">
                    <Field id="cz-size" label={options.size.label} required={options.size.required} error={errors.size}>
                      <select
                        id="cz-size"
                        value={size ?? ""}
                        onChange={(e) => {
                          setSize(e.target.value || undefined);
                          setErrors((er) => ({ ...er, size: undefined }));
                        }}
                        aria-invalid={Boolean(errors.size)}
                        aria-describedby="cz-size-msg"
                        className="h-11 w-full rounded-xl border border-ip-line bg-white px-4 text-sm focus:border-ip-teal focus:outline-none focus:ring-2 focus:ring-ip-cyan/50"
                      >
                        <option value="">{options.size.required ? "Choisir…" : "Aucune préférence"}</option>
                        {options.size.values.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}
                {cs && (
                  <fieldset className="rounded-2xl border border-ip-line p-4" data-testid="custom-size">
                    <legend className="px-1 text-sm font-medium">Dimensions (cm)</legend>
                    <div className="grid grid-cols-2 gap-3">
                      <Field id="cz-width" label={`Largeur (${cs.minWidthCm}–${cs.maxWidthCm})`}>
                        <input
                          id="cz-width"
                          type="number"
                          inputMode="decimal"
                          min={cs.minWidthCm}
                          max={cs.maxWidthCm}
                          value={wInput}
                          onChange={(e) => {
                            setWInput(e.target.value);
                            setErrors((er) => ({ ...er, dimensions: undefined }));
                          }}
                          aria-invalid={Boolean(errors.dimensions)}
                          aria-describedby="cz-width-msg"
                          className="h-11 w-full rounded-xl border border-ip-line px-3 text-sm focus:border-ip-teal focus:outline-none focus:ring-2 focus:ring-ip-cyan/50"
                        />
                      </Field>
                      <Field id="cz-height" label={`Hauteur (${cs.minHeightCm}–${cs.maxHeightCm})`}>
                        <input
                          id="cz-height"
                          type="number"
                          inputMode="decimal"
                          min={cs.minHeightCm}
                          max={cs.maxHeightCm}
                          value={hInput}
                          onChange={(e) => {
                            setHInput(e.target.value);
                            setErrors((er) => ({ ...er, dimensions: undefined }));
                          }}
                          aria-invalid={Boolean(errors.dimensions)}
                          aria-describedby="cz-height-msg"
                          className="h-11 w-full rounded-xl border border-ip-line px-3 text-sm focus:border-ip-teal focus:outline-none focus:ring-2 focus:ring-ip-cyan/50"
                        />
                      </Field>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {quickSizes.map((q) => (
                        <button
                          key={`${q.w}x${q.h}`}
                          type="button"
                          onClick={() => {
                            setWInput(String(q.w));
                            setHInput(String(q.h));
                            setErrors((er) => ({ ...er, dimensions: undefined }));
                          }}
                          className={cn("h-9 rounded-lg border-2 px-3 text-xs font-semibold", Number(wInput) === q.w && Number(hInput) === q.h ? "border-ip-teal bg-ip-teal/5 text-ip-teal" : "border-ip-line hover:border-ip-teal/60")}
                        >
                          {q.w} × {q.h} cm
                        </button>
                      ))}
                    </div>
                    <p id="cz-dimensions" tabIndex={-1} className={cn("mt-2 min-h-4 text-xs", errors.dimensions ? "text-red-700" : "text-ip-muted")} role={errors.dimensions ? "alert" : undefined}>
                      {errors.dimensions ?? (area !== null ? `Surface facturée : ${area.toFixed(2)} m² (minimum ${cs.minBillableM2} m²)` : "")}
                    </p>
                  </fieldset>
                )}
              </div>
            </section>
          )}

          {/* 3 · Quantity */}
          <section aria-labelledby="step-qty">
            <h3 id="step-qty" className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-ip-teal text-sm text-white">{hasOptions ? 3 : 2}</span> Quantité
            </h3>
            <label htmlFor="cz-quantity" className="mb-2 block text-sm font-medium">
              Nombre de {product.unitLabel}s — minimum {product.minQty}
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <div className="inline-flex items-center rounded-xl border border-ip-line">
                <button
                  type="button"
                  aria-label="Diminuer la quantité"
                  onClick={() => setQtyInput(String(Math.max(product.minQty, (validQty ? qty : product.minQty) - 1)))}
                  className="inline-flex size-11 items-center justify-center rounded-l-xl hover:bg-ip-mist"
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <input
                  id="cz-quantity"
                  type="number"
                  inputMode="numeric"
                  min={product.minQty}
                  max={100000}
                  value={qtyInput}
                  onChange={(e) => {
                    setQtyInput(e.target.value);
                    setErrors((er) => ({ ...er, quantity: undefined }));
                  }}
                  aria-invalid={Boolean(errors.quantity)}
                  aria-describedby="cz-quantity-msg"
                  className="h-11 w-24 border-x border-ip-line text-center font-semibold focus:outline-none"
                />
                <button
                  type="button"
                  aria-label="Augmenter la quantité"
                  onClick={() => setQtyInput(String((validQty ? qty : product.minQty - 1) + 1))}
                  className="inline-flex size-11 items-center justify-center rounded-r-xl hover:bg-ip-mist"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>
              <div className="text-sm" aria-live="polite">
                <span className="text-ip-muted">
                  {formatHTG(unit)} / {product.unitLabel}
                </span>
                <span className="block text-xl font-bold" data-testid="line-estimate">
                  {validQty && dimsValid ? formatHTG(unit * qty) : "—"}
                </span>
              </div>
            </div>
            <p id="cz-quantity-msg" className="mt-1 min-h-4 text-xs text-red-700" role={errors.quantity ? "alert" : undefined}>
              {errors.quantity ?? ""}
            </p>
          </section>

          <Field id="cz-notes" label="Précisions (facultatif)" hint="Instructions pour notre équipe, date souhaitée… (1000 caractères max.)">
            <Textarea id="cz-notes" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} aria-describedby="cz-notes-msg" className="min-h-20" />
          </Field>

          <div className="rounded-2xl bg-ip-mist p-4">
            <p className="text-xs text-ip-muted">
              Estimation hors livraison ; prix final confirmé après validation. Une maquette vous est envoyée avant production.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <Button type="submit" variant="outline" size="lg" className="flex-1" data-testid="add-to-cart">
                <ShoppingCart aria-hidden="true" /> Ajouter au panier
              </Button>
              <Button type="button" variant="sun" size="lg" className="flex-1" onClick={() => addToCart(true)} data-testid="order-now">
                Commander maintenant <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </form>
      </div>
      {finalOpen && <FinalPreviewDialog productName={product.name} productSlug={product.slug} color={color} size={size} elements={elements} onClose={() => setFinalOpen(false)} />}
    </div>
  );
}
