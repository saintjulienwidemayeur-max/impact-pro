/**
 * Design model shared by the studio, the cart and the order payload (docs/customizer-v2-contract.md §4–5).
 * A design is a flat list of elements; each element belongs to one print zone (placement).
 */
import { placementLabels, type CustomOrderElement, type Placement, type PriceTier, type Product } from "./api";
import { toNumber, unitPriceFor } from "./pricing";

export type ElementKind = "LOGO" | "TEXT" | "ARTWORK";

export const FONT_IDS = ["fredoka", "inter", "pacifico", "bebas-neue", "playfair", "montserrat", "dancing-script", "oswald"] as const;
export type FontId = (typeof FONT_IDS)[number];

export interface FontDef {
  id: FontId;
  label: string;
  /** CSS family registered in `studio-fonts.css`. */
  family: string;
  /** Whether a bold file exists (otherwise bold is hidden). */
  hasBold: boolean;
}

export const FONTS: FontDef[] = [
  { id: "inter", label: "Inter", family: '"IP Inter"', hasBold: true },
  { id: "fredoka", label: "Fredoka", family: '"IP Fredoka"', hasBold: true },
  { id: "montserrat", label: "Montserrat", family: '"IP Montserrat"', hasBold: true },
  { id: "oswald", label: "Oswald", family: '"IP Oswald"', hasBold: true },
  { id: "bebas-neue", label: "Bebas Neue", family: '"IP Bebas Neue"', hasBold: false },
  { id: "playfair", label: "Playfair Display", family: '"IP Playfair"', hasBold: true },
  { id: "pacifico", label: "Pacifico", family: '"IP Pacifico"', hasBold: false },
  { id: "dancing-script", label: "Dancing Script", family: '"IP Dancing Script"', hasBold: true },
];

export const fontById = (id: FontId | undefined): FontDef => FONTS.find((f) => f.id === id) ?? FONTS[0];

export const TEXT_COLORS = ["#000000", "#FFFFFF", "#0A716A", "#42C6F0", "#FFC93C", "#C62828", "#1F3B8A", "#2E7D32", "#E65100", "#6D4C41"];
export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const MAX_TEXT_LENGTH = 200;
export const MAX_TEXT_LINES = 6;
export const MAX_ELEMENTS = 30;

export interface UploadRef {
  id: string;
  url: string;
  mimeType: string;
  originalName: string;
  width?: number;
  height?: number;
}

export interface DesignElement {
  id: string;
  placement: Placement;
  kind: ElementKind;
  /** LOGO / ARTWORK */
  upload?: UploadRef;
  /** TEXT */
  text?: string;
  font?: FontId;
  fontWeight?: "regular" | "bold";
  color?: string;
  align?: "left" | "center" | "right";
  /** Center offset inside the print area, fraction of the area width / height (−0.5..0.5). */
  x: number;
  y: number;
  /** 1 = contain-fit in the area (images) / base font size (text). 0.05..4 */
  scale: number;
  /** degrees, −180..180 */
  rotation: number;
}

export const SCALE_MIN = 0.05;
export const SCALE_MAX = 4;

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function newTextElement(placement: Placement): DesignElement {
  return { id: newId(), placement, kind: "TEXT", text: "Votre texte", font: "inter", fontWeight: "bold", color: "#000000", align: "center", x: 0, y: 0, scale: 1, rotation: 0 };
}

export function newUploadElement(placement: Placement, kind: "LOGO" | "ARTWORK", upload: UploadRef): DesignElement {
  return { id: newId(), placement, kind, upload, x: 0, y: 0, scale: kind === "LOGO" ? 0.8 : 1, rotation: 0 };
}

/* ---------- Product capabilities (tolerant of an API that predates v2) ---------- */

export interface CustomSize {
  minWidthCm: number;
  maxWidthCm: number;
  minHeightCm: number;
  maxHeightCm: number;
  defaultWidthCm: number;
  defaultHeightCm: number;
  minBillableM2: number;
}

export interface Zone {
  placement: Placement;
  label: string;
  maxElements: number;
}

export interface ProductCaps {
  pricingMode: "PER_PIECE" | "PER_AREA";
  supportsLogo: boolean;
  supportsText: boolean;
  supportsArtwork: boolean;
  artworkRequired: boolean;
  customSize: CustomSize | null;
  zones: Zone[];
}

export const placementLabelsFr: Record<Placement, string> = placementLabels;

/* ---------- Product parameters: only what the product really needs (contract §7.1) ---------- */

export interface OptionDef {
  /** Field label shown to the customer (« Couleur », « Modèle du téléphone », « Dimensions »…). */
  label: string;
  required: boolean;
  values: string[];
}

export interface ProductOptions {
  color: OptionDef | null;
  size: OptionDef | null;
}

/**
 * A color / size block exists only when the product lists values for it (a ball has none, so nothing is asked).
 * Sizes are not an option when the product has a free custom size (banners…): there they are quick-pick dimensions.
 */
export function optionsOf(p: Pick<Product, "colors" | "sizes" | "colorLabel" | "sizeLabel" | "colorsRequired" | "sizesRequired" | "customSize">): ProductOptions {
  const colors = p.colors ?? [];
  const sizes = p.sizes ?? [];
  return {
    color: colors.length ? { label: p.colorLabel?.trim() || "Couleur", required: p.colorsRequired ?? true, values: colors } : null,
    size: sizes.length && !p.customSize ? { label: p.sizeLabel?.trim() || "Taille", required: p.sizesRequired ?? true, values: sizes } : null,
  };
}

/** « Taille : M · Couleur : Rouge » style summary used by the cart, checkout, confirmation and tracking. */
export function describeOptions(o: { color?: string | null; size?: string | null; colorLabel?: string | null; sizeLabel?: string | null; widthCm?: number | null; heightCm?: number | null }): string[] {
  const out: string[] = [];
  if (o.color) out.push(`${o.colorLabel || "Couleur"} : ${o.color}`);
  if (o.size) out.push(`${o.sizeLabel || "Taille"} : ${o.size}`);
  if (o.widthCm && o.heightCm) out.push(`${o.widthCm} × ${o.heightCm} cm`);
  return out;
}

export function capsOf(p: Product): ProductCaps {
  const placements: Placement[] = p.placements?.length ? p.placements : ["FRONT"];
  return {
    pricingMode: p.pricingMode ?? "PER_PIECE",
    supportsLogo: p.supportsLogo ?? true,
    supportsText: p.supportsText ?? true,
    supportsArtwork: p.supportsArtwork ?? false,
    artworkRequired: p.artworkRequired ?? false,
    customSize: p.customSize ?? null,
    zones: p.zones?.length ? p.zones : placements.map((placement) => ({ placement, label: placementLabelsFr[placement] ?? placement, maxElements: 10 })),
  };
}

/* ---------- Price estimate (mirrors the server rule; always labelled « estimation ») ---------- */

export interface PriceInput {
  quantity: number;
  basePrice: string;
  priceTiers: PriceTier[];
  pricingMode?: "PER_PIECE" | "PER_AREA";
  customSize?: CustomSize | null;
  widthCm?: number;
  heightCm?: number;
}

export function areaM2(p: Pick<PriceInput, "customSize" | "widthCm" | "heightCm">): number | null {
  if (!p.customSize || !p.widthCm || !p.heightCm) return null;
  return Math.max((p.widthCm * p.heightCm) / 10_000, p.customSize.minBillableM2 || 0);
}

export function estimateUnit(p: PriceInput): number {
  const rate = unitPriceFor(p.quantity, p.basePrice, p.priceTiers);
  if (p.pricingMode === "PER_AREA") {
    const a = areaM2(p);
    return a === null ? rate : Math.round(a * rate * 100) / 100;
  }
  return rate;
}

/** Rebuilds renderable design elements from the elements an order returns (confirmation / tracking mock-ups). */
export function fromOrderElements(els: CustomOrderElement[]): DesignElement[] {
  return [...els]
    .sort((a, b) => a.sort - b.sort)
    .map((e, i) => ({
      id: `order-${i}`,
      placement: e.placement,
      kind: e.kind,
      upload: e.logoUrl
        ? { id: "", url: e.logoUrl, mimeType: /\.pdf$/i.test(e.originalName ?? e.logoUrl) ? "application/pdf" : "image/png", originalName: e.originalName ?? "" }
        : undefined,
      text: e.text ?? undefined,
      font: e.font ?? undefined,
      fontWeight: e.fontWeight ?? undefined,
      color: e.color ?? undefined,
      align: e.align ?? undefined,
      x: e.x,
      y: e.y,
      scale: e.scale,
      rotation: e.rotation,
    }));
}

/* ---------- Order payload ---------- */

export interface OrderElementPayload {
  placement: Placement;
  kind: ElementKind;
  uploadId?: string;
  text?: string;
  font?: FontId;
  fontWeight?: "regular" | "bold";
  color?: string;
  align?: "left" | "center" | "right";
  x: number;
  y: number;
  scale: number;
  rotation: number;
  sort: number;
}

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

export function toOrderElements(elements: DesignElement[]): OrderElementPayload[] {
  return elements.map((e, sort) => {
    const base = { placement: e.placement, kind: e.kind, x: round(clamp(e.x, -0.5, 0.5)), y: round(clamp(e.y, -0.5, 0.5)), scale: round(clamp(e.scale, SCALE_MIN, SCALE_MAX)), rotation: round(clamp(e.rotation, -180, 180), 2), sort };
    if (e.kind === "TEXT") {
      return { ...base, text: e.text ?? "", font: e.font ?? "inter", fontWeight: e.fontWeight ?? "regular", color: e.color ?? "#000000", align: e.align ?? "center" };
    }
    return { ...base, uploadId: e.upload?.id };
  });
}

/** Zones that currently carry at least one element, in display order, with counts for summaries. */
export function summarizeZones(elements: DesignElement[]): { placement: Placement; logos: number; texts: number; artworks: number; firstText?: string }[] {
  const order: Placement[] = [];
  for (const e of elements) if (!order.includes(e.placement)) order.push(e.placement);
  return order.map((placement) => {
    const els = elements.filter((e) => e.placement === placement);
    return {
      placement,
      logos: els.filter((e) => e.kind === "LOGO").length,
      texts: els.filter((e) => e.kind === "TEXT").length,
      artworks: els.filter((e) => e.kind === "ARTWORK").length,
      firstText: els.find((e) => e.kind === "TEXT")?.text,
    };
  });
}

export function describeZone(z: ReturnType<typeof summarizeZones>[number]): string {
  const parts: string[] = [];
  if (z.logos) parts.push(`${z.logos} logo${z.logos > 1 ? "s" : ""}`);
  if (z.artworks) parts.push("fichier prêt à imprimer");
  if (z.texts) parts.push(z.texts === 1 && z.firstText ? `texte « ${z.firstText.replace(/\s+/g, " ").slice(0, 28)}${z.firstText.length > 28 ? "…" : ""} »` : `${z.texts} textes`);
  return parts.join(" + ");
}

export { toNumber };
