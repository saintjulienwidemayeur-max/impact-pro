/**
 * Canvas rendering of a print zone (docs/customizer-v2-contract.md): every element (logo / text / artwork) is composed
 * into the flat print-area frame, then wrapped on the product surface (cylinder + bow), multiplied with the logo-free
 * photo on light items, or shaded with the photo luminance on dark items.
 */
import { clamp, fontById, type DesignElement } from "./design";

export interface AreaGeometry {
  /** Fractions of the photo width (box size) / width+height (center). */
  cx: number;
  cy: number;
  w: number;
  h: number;
  rot: number;
  curve?: { phi: number; arch: number };
}

/* ---------- Assets ---------- */

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        imageCache.delete(src);
        reject(new Error(`Image load failed: ${src}`));
      };
      img.src = src;
    });
    imageCache.set(src, p);
  }
  return p;
}

/** Mean luminance (0..1) of the opaque pixels of a same-origin photo, on a tiny canvas (never the tainted one). */
export function meanLuminance(img: HTMLImageElement): number {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 24;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 0.8;
    ctx.drawImage(img, 0, 0, 24, 24);
    const d = ctx.getImageData(0, 0, 24, 24).data;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      n++;
    }
    return n ? sum / n : 0.8;
  } catch {
    return 0.8;
  }
}

function fontCss(el: DesignElement, px: number): string {
  const f = fontById(el.font);
  const weight = el.fontWeight === "bold" && f.hasBold ? 700 : 400;
  return `${weight} ${px}px ${f.family}, system-ui, sans-serif`;
}

/** Loads the fonts the text elements need (canvas text is blank until the font is ready). */
export async function ensureFonts(elements: DesignElement[]): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const wanted = new Set<string>();
  for (const e of elements) if (e.kind === "TEXT") wanted.add(fontCss(e, 32));
  await Promise.all([...wanted].map((f) => document.fonts.load(f, "Abc").catch(() => [])));
}

/* ---------- Geometry ---------- */

export const TEXT_BASE = 0.28; // base font size = 28 % of the print-area height at scale 1
const LINE_HEIGHT = 1.18;

let measureCtx: CanvasRenderingContext2D | null = null;
function measurer(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx;
  if (typeof document === "undefined") return null;
  measureCtx = document.createElement("canvas").getContext("2d");
  return measureCtx;
}

export function textLines(el: DesignElement): string[] {
  return (el.text ?? "").split("\n").slice(0, 6);
}

export type ImageLookup = (el: DesignElement) => HTMLImageElement | null | undefined;

/** Unrotated element box in the same unit as (bw, bh) — used both to draw and to place the interactive handles. */
export function elementBox(el: DesignElement, bw: number, bh: number, img?: HTMLImageElement | null): { w: number; h: number } {
  if (el.kind === "TEXT") {
    const px = bh * TEXT_BASE * el.scale;
    const ctx = measurer();
    const lines = textLines(el);
    let w = px * 0.6 * Math.max(1, ...lines.map((l) => l.length));
    if (ctx) {
      ctx.font = fontCss(el, px);
      w = Math.max(px * 0.4, ...lines.map((l) => ctx.measureText(l || " ").width));
    }
    return { w, h: Math.max(1, lines.length) * px * LINE_HEIGHT };
  }
  if (img && img.naturalWidth) {
    const fit = Math.min(bw / img.naturalWidth, bh / img.naturalHeight) * el.scale;
    return { w: img.naturalWidth * fit, h: img.naturalHeight * fit };
  }
  const side = Math.min(bw, bh) * 0.5 * el.scale; // PDF / not yet loaded
  return { w: side, h: side };
}

function drawElement(ctx: CanvasRenderingContext2D, el: DesignElement, bw: number, bh: number, img?: HTMLImageElement | null) {
  ctx.save();
  ctx.translate(bw / 2 + el.x * bw, bh / 2 + el.y * bh);
  ctx.rotate((el.rotation * Math.PI) / 180);
  const box = elementBox(el, bw, bh, img);
  if (el.kind === "TEXT") {
    const px = bh * TEXT_BASE * el.scale;
    ctx.font = fontCss(el, px);
    ctx.fillStyle = el.color ?? "#000000";
    ctx.textBaseline = "middle";
    const align = el.align ?? "center";
    ctx.textAlign = align;
    const x = align === "left" ? -box.w / 2 : align === "right" ? box.w / 2 : 0;
    const lines = textLines(el);
    lines.forEach((line, i) => ctx.fillText(line, x, (i - (lines.length - 1) / 2) * px * LINE_HEIGHT));
  } else if (img && img.naturalWidth) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, -box.w / 2, -box.h / 2, box.w, box.h);
  } else {
    // PDF (cannot be rasterized in the browser): neutral placeholder
    ctx.fillStyle = "rgba(14,42,46,0.12)";
    ctx.strokeStyle = "rgba(14,42,46,0.45)";
    ctx.lineWidth = Math.max(1, box.w * 0.01);
    ctx.fillRect(-box.w / 2, -box.h / 2, box.w, box.h);
    ctx.strokeRect(-box.w / 2, -box.h / 2, box.w, box.h);
    ctx.fillStyle = "rgba(14,42,46,0.75)";
    ctx.font = `700 ${box.w * 0.22}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PDF", 0, 0);
  }
  ctx.restore();
}

/* ---------- Main renderer ---------- */

export interface DrawOptions {
  /** Photo frame size in CSS px. */
  width: number;
  height: number;
  area: AreaGeometry;
  light: boolean;
  elements: DesignElement[];
  image: ImageLookup;
  /** Logo-free photo used for shading (null for plain frames). */
  photo: HTMLImageElement | null;
  photoMean: number;
}

export function drawZone(canvas: HTMLCanvasElement, opts: DrawOptions) {
  const { width, height, area, light, elements, image, photo, photoMean } = opts;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!elements.length) return;

  const bw = Math.max(2, Math.round(area.w * width * dpr));
  const bh = Math.max(2, Math.round(area.h * width * dpr));

  // 1) flat composition in the print-area frame
  const flat = document.createElement("canvas");
  flat.width = bw;
  flat.height = bh;
  const fctx = flat.getContext("2d");
  if (!fctx) return;
  for (const el of elements) drawElement(fctx, el, bw, bh, image(el));

  // 2) wrap on a curved surface: per-column resampling (cylinder) + vertical bow
  const curve = area.curve;
  const pad = curve ? Math.ceil(Math.abs(curve.arch) * bh) + 2 : 0;
  const layer = document.createElement("canvas");
  layer.width = bw;
  layer.height = bh + pad * 2;
  const lctx = layer.getContext("2d");
  if (!lctx) return;
  if (curve && curve.phi > 0.01) {
    const sinMax = Math.sin(curve.phi);
    const us = (j: number) => 0.5 + Math.asin(clamp(((j / bw) * 2 - 1) * sinMax, -1, 1)) / (2 * curve.phi);
    for (let j = 0; j < bw; j++) {
      const t = ((j + 0.5) / bw) * 2 - 1;
      const sx0 = us(j) * bw;
      const sx1 = us(j + 1) * bw;
      const sw = Math.max(1, Math.abs(sx1 - sx0));
      lctx.drawImage(flat, Math.min(bw - sw, Math.max(0, Math.min(sx0, sx1))), 0, sw, bh, j, pad + curve.arch * bh * (1 - t * t), 1, bh);
    }
  } else {
    lctx.drawImage(flat, 0, pad);
  }

  // 3) dark surfaces: shade with the photo luminance (grayscale, lifted so the flat surface = 1)
  let final: HTMLCanvasElement = layer;
  if (!light && photo) {
    const shade = document.createElement("canvas");
    shade.width = layer.width;
    shade.height = layer.height;
    const shaded = document.createElement("canvas");
    shaded.width = layer.width;
    shaded.height = layer.height;
    const hctx = shade.getContext("2d");
    const sctx = shaded.getContext("2d");
    if (hctx && sctx) {
      hctx.save();
      hctx.translate(bw / 2, layer.height / 2);
      hctx.rotate((-area.rot * Math.PI) / 180);
      hctx.translate(-area.cx * width * dpr, -area.cy * height * dpr);
      hctx.drawImage(photo, 0, 0, width * dpr, height * dpr);
      hctx.restore();
      hctx.globalCompositeOperation = "color"; // luminosity only: the surface color must not tint the design
      hctx.fillStyle = "#808080";
      hctx.fillRect(0, 0, shade.width, shade.height);
      hctx.globalCompositeOperation = "lighter"; // Safari has no ctx.filter: lift the mean to white additively
      hctx.fillStyle = `rgba(255,255,255,${clamp(1 - photoMean, 0, 1)})`;
      hctx.fillRect(0, 0, shade.width, shade.height);
      sctx.drawImage(layer, 0, 0);
      sctx.globalCompositeOperation = "multiply";
      sctx.drawImage(shade, 0, 0);
      sctx.globalCompositeOperation = "destination-in";
      sctx.drawImage(layer, 0, 0);
      final = shaded;
    }
  }

  // 4) place in the photo frame (rotated box), slightly soft like ink / thread on fabric
  ctx.save();
  ctx.translate(area.cx * width * dpr, area.cy * height * dpr);
  ctx.rotate((area.rot * Math.PI) / 180);
  ctx.globalAlpha = light ? 0.97 : 0.95;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(final, -bw / 2, -bh / 2 - pad);
  ctx.restore();
}
