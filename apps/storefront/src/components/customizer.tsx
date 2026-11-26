"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ArrowRight, Minus, Move, Plus, RotateCcw, ShoppingCart } from "lucide-react";
import { useCart, type PreviewParams } from "./cart-provider";
import { DEFAULT_PREVIEW, LogoPreview } from "./logo-preview";
import { LogoUploader } from "./logo-uploader";
import { Button } from "./ui/button";
import { Field, Textarea } from "./ui/field";
import { previewFor, productPhotos } from "@/config/product-media";
import { placementLabels, type Placement, type Product, type UploadedLogo } from "@/lib/api";
import { sortedTiers, toNumber, unitPriceFor } from "@/lib/pricing";
import { cn, formatHTG } from "@/lib/utils";

type Errors = Partial<Record<"logo" | "color" | "size" | "quantity", string>>;

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
];
const swatchFor = (color: string) => swatches.find(([re]) => re.test(color))?.[1];

export function Customizer({ product }: { product: Product }) {
  const router = useRouter();
  const { add } = useCart();
  const placements: Placement[] = product.placements.length ? product.placements : ["FRONT"];
  const tiers = sortedTiers(product.priceTiers);
  const gallery = productPhotos(product);

  const [logo, setLogo] = React.useState<UploadedLogo | null>(null);
  const [placement, setPlacement] = React.useState<Placement>(placements[0]);
  const [color, setColor] = React.useState<string | undefined>(product.colors[0]);
  const [size, setSize] = React.useState<string | undefined>(undefined);
  const [qtyInput, setQtyInput] = React.useState(String(product.minQty));
  const [notes, setNotes] = React.useState("");
  const [preview, setPreview] = React.useState<PreviewParams>(DEFAULT_PREVIEW);
  const [view, setView] = React.useState<"preview" | number>("preview");
  const [errors, setErrors] = React.useState<Errors>({});

  const qty = Number.parseInt(qtyInput, 10);
  const validQty = Number.isInteger(qty) && qty >= product.minQty && qty <= 100_000;
  const unit = unitPriceFor(validQty ? qty : product.minQty, product.basePrice, tiers);
  const target = previewFor(product.slug, placement, color);
  const isImageLogo = Boolean(logo?.mimeType.startsWith("image/"));

  React.useEffect(() => setPreview(DEFAULT_PREVIEW), [placement]);
  React.useEffect(() => {
    if (logo) setView("preview");
  }, [logo]);

  function validate(): boolean {
    const next: Errors = {};
    if (!logo) next.logo = "Téléversez votre logo pour continuer.";
    if (product.colors.length && !color) next.color = "Choisissez une couleur.";
    if (product.sizes.length && !size) next.size = "Choisissez une taille.";
    if (!validQty) next.quantity = `Quantité minimale : ${product.minQty} ${product.unitLabel}.`;
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) document.getElementById(`cz-${first}`)?.focus();
    return !first;
  }

  function addToCart(goToCheckout: boolean) {
    if (!validate() || !logo) return;
    add({
      productSlug: product.slug,
      productName: product.name,
      unitLabel: product.unitLabel,
      minQty: product.minQty,
      basePrice: product.basePrice,
      priceTiers: tiers,
      quantity: qty,
      color,
      size,
      placement,
      logo: { id: logo.id, url: logo.url, mimeType: logo.mimeType, originalName: logo.originalName },
      preview,
      notes: notes.trim() || undefined,
    });
    if (goToCheckout) router.push("/commande");
  }

  const mainPhoto = view === "preview" ? target?.photo : gallery[view];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
      {/* Visual */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        <div className="overflow-hidden rounded-[1.5rem] border border-ip-line bg-white">
          {view === "preview" && target ? (
            <LogoPreview
              photo={target.photo}
              area={target.area}
              logo={logo}
              params={preview}
              onChange={isImageLogo ? setPreview : undefined}
              priority
            />
          ) : mainPhoto ? (
            <div className="relative w-full bg-white" style={{ aspectRatio: `${mainPhoto.width} / ${mainPhoto.height}` }}>
              <Image src={mainPhoto.src} alt={mainPhoto.alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-contain" />
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center bg-ip-mist text-sm text-ip-muted">Photo à venir</div>
          )}
        </div>
        {gallery.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Vues du produit">
            {target && (
              <button
                type="button"
                role="tab"
                aria-selected={view === "preview"}
                onClick={() => setView("preview")}
                className={cn("relative size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white", view === "preview" ? "border-ip-teal" : "border-ip-line")}
              >
                <Image src={target.photo.src} alt="" fill sizes="64px" className="object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-ip-teal py-0.5 text-[9px] font-bold uppercase text-white">Aperçu</span>
              </button>
            )}
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
        {logo && isImageLogo && view === "preview" && (
          <div className="mt-4 rounded-2xl border border-ip-line bg-ip-mist p-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="cz-scale" className="text-sm font-semibold">
                Taille du logo
              </label>
              <button
                type="button"
                onClick={() => setPreview(DEFAULT_PREVIEW)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-ip-teal hover:underline"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" /> Recentrer
              </button>
            </div>
            <input
              id="cz-scale"
              type="range"
              min={0.4}
              max={1.4}
              step={0.05}
              value={preview.scale}
              onChange={(e) => setPreview((p) => ({ ...p, scale: Number(e.target.value) }))}
              className="mt-2 w-full accent-ip-teal"
            />
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ip-muted">
              <Move className="size-3.5" aria-hidden="true" /> Faites glisser le logo pour ajuster sa position.
            </p>
          </div>
        )}
        {logo && !isImageLogo && (
          <p className="mt-3 rounded-xl bg-ip-mist p-3 text-xs text-ip-muted">
            Logo PDF reçu : l&apos;aperçu final vous sera envoyé par notre équipe avant production.
          </p>
        )}
      </div>

      {/* Configuration */}
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
                <th scope="col" className="px-4 py-2 text-right font-semibold">Prix / {product.unitLabel}</th>
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
          className="mt-8 space-y-7"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            addToCart(false);
          }}
        >
          <section aria-labelledby="step-logo">
            <h3 id="step-logo" className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-ip-teal text-sm text-white">1</span> Votre logo
            </h3>
            <LogoUploader
              id="cz-logo"
              value={logo}
              onChange={(l) => {
                setLogo(l);
                setErrors((e) => ({ ...e, logo: undefined }));
              }}
              error={errors.logo}
            />
          </section>

          <section aria-labelledby="step-options">
            <h3 id="step-options" className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-ip-teal text-sm text-white">2</span> Options
            </h3>
            <div className="space-y-5">
              <div>
                <p id="lbl-placement" className="mb-2 text-sm font-medium">
                  Emplacement du marquage
                </p>
                <div role="radiogroup" aria-labelledby="lbl-placement" className="flex flex-wrap gap-2">
                  {placements.map((p) => (
                    <Chip key={p} selected={placement === p} onClick={() => setPlacement(p)}>
                      {placementLabels[p] ?? p}
                    </Chip>
                  ))}
                </div>
              </div>
              {product.colors.length > 0 && (
                <div>
                  <p id="lbl-color" className="mb-2 text-sm font-medium">
                    Couleur
                  </p>
                  <div role="radiogroup" aria-labelledby="lbl-color" id="cz-color" tabIndex={-1} className="flex flex-wrap gap-2">
                    {product.colors.map((c) => (
                      <Chip
                        key={c}
                        selected={color === c}
                        swatch={swatchFor(c)}
                        onClick={() => {
                          setColor(c);
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
              {product.sizes.length > 0 && (
                <Field id="cz-size" label="Taille" required error={errors.size}>
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
                    <option value="">Choisir…</option>
                    {product.sizes.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          </section>

          <section aria-labelledby="step-qty">
            <h3 id="step-qty" className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-ip-teal text-sm text-white">3</span> Quantité
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
                <span className="text-ip-muted">{formatHTG(unit)} / {product.unitLabel}</span>
                <span className="block text-xl font-bold" data-testid="line-estimate">
                  {validQty ? formatHTG(unit * qty) : "—"}
                </span>
              </div>
            </div>
            <p id="cz-quantity-msg" className="mt-1 min-h-4 text-xs text-red-700" role={errors.quantity ? "alert" : undefined}>
              {errors.quantity ?? ""}
            </p>
          </section>

          <Field id="cz-notes" label="Précisions (facultatif)" hint="Couleurs du logo, texte à ajouter, date souhaitée…">
            <Textarea id="cz-notes" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} aria-describedby="cz-notes-msg" className="min-h-20" />
          </Field>

          <div className="rounded-2xl bg-ip-mist p-4">
            <p className="text-xs text-ip-muted">
              Estimation hors livraison. Le prix final est calculé à la validation de la commande, puis une maquette vous est envoyée avant production.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <Button type="submit" variant="outline" size="lg" className="flex-1">
                <ShoppingCart aria-hidden="true" /> Ajouter au panier
              </Button>
              <Button type="button" variant="sun" size="lg" className="flex-1" onClick={() => addToCart(true)}>
                Commander maintenant <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
