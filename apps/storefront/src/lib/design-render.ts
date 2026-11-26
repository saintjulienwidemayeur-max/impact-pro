/**
 * Canvas rendering of a print zone (docs/customizer-v2-contract.md): every element (logo / text / artwork) is composed
 * into the flat print-area frame, then wrapped on the product surface (cylinder + bow, or a perspective quad), multiplied
 * with the logo-free photo on light items, or shaded with the photo luminance on dark items.
 */
import { clamp, fontById, type DesignElement } from "./design";
import { warpToQuad, type Quad } from "./quad";

export interface AreaGeometry {
  /** Fractions of the photo width (box size) / width+height (center). */
  cx: number;
  cy: number;
  w: number;
  h: number;
  rot: number;
  curve?: { phi: number; arch: number };
  /** Perspective print area: [TL, TR, BR, BL] as fractions of the photo width / height (contract §7.3). */
  quad?: Quad;
  /** Aspect (w / h) of the flat print area mapped onto `quad`. */
  aspect?: number;
}

/* ---------- Assets ---------- */

const imageCache = new Map<string, Promise<HTMLImageElement>>();
/** Images that could only be loaded without CORS: drawing them taints a canvas (no PNG export). */
const tainted = new WeakSet<HTMLImageElement>();
export const isTaintedImage = (img: HTMLImageElement | null | undefined) => Boolean(img && tainted.has(img));

function loadPlain(src: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image load failed: ${src}`));
    img.src = src;
  });
}

/**
 * Loads an image once. Cross-origin images (uploads served by the API) are requested with CORS so canvases stay
 * exportable; if the server refuses CORS the image is still loaded (tainted) so the on-screen preview keeps working.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imageCache.get(src);
  if (!p) {
    const sameOrigin = src.startsWith("/") || src.startsWith("blob:") || src.startsWith("data:") || (typeof location !== "undefined" && src.startsWith(location.origin));
    const load = sameOrigin
      ? loadPlain(src, false)
      : loadPlain(src, true).catch(async () => {
          const img = await loadPlain(src, false);
          tainted.add(img);
          return img;
        });
    p = load.catch((e) => {
      imageCache.delete(src);
      throw e;
    });
    imageCache.set(src, p);
  }
  return p;
}

export const isLightHex = (hex: string | null | undefined): boolean => {
  if (!hex) return true;
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return true;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => Number.parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
};

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

/**
 * Scale (≤ 1) that makes a text element fit inside a print area (`area.w × area.h`, any consistent unit).
 * Fonts must be loaded first (see `ensureFonts`) or the measure uses the fallback font.
 */
export function fitTextScale(el: DesignElement, area: { w: number; h: number }): number {
  const bw = area.w * 1000;
  const bh = area.h * 1000;
  const b = elementBox({ ...el, scale: 1 }, bw, bh);
  const s = Math.min(1, (bw * 0.88) / Math.max(1, b.w), (bh * 0.9) / Math.max(1, b.h));
  return Math.max(0.05, Math.round(s * 100) / 100);
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
  /** Device pixel ratio (defaults to the window's, capped at 2). */
  dpr?: number;
}

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Size (device px) of the flat print-area frame the elements are composed into. */
export function flatSize(area: AreaGeometry, width: number, height: number, dpr: number): { bw: number; bh: number } {
  if (area.quad && area.aspect) {
    const q = area.quad;
    const top = Math.hypot((q[1][0] - q[0][0]) * width * dpr, (q[1][1] - q[0][1]) * height * dpr);
    const bottom = Math.hypot((q[2][0] - q[3][0]) * width * dpr, (q[2][1] - q[3][1]) * height * dpr);
    const bw = Math.min(2048, Math.max(2, Math.round(Math.max(top, bottom))));
    return { bw, bh: Math.max(2, Math.round(bw / area.aspect)) };
  }
  return { bw: Math.max(2, Math.round(area.w * width * dpr)), bh: Math.max(2, Math.round(area.h * width * dpr)) };
}

/**
 * Renders the design layer of a zone in photo-frame coordinates (a canvas of `width × height` × dpr):
 * flat composition → wrap (cylinder + bow) or perspective warp → grayscale shading on dark surfaces.
 * Light surfaces are NOT shaded here: the layer is multiplied with the photo by the caller (CSS blend or `renderMockup`).
 */
export function renderLayer(opts: DrawOptions): HTMLCanvasElement | null {
  const { width, height, area, light, elements, image, photo, photoMean } = opts;
  if (!elements.length) return null;
  const dpr = opts.dpr ?? Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.round(width * dpr);
  const H = Math.round(height * dpr);
  const { bw, bh } = flatSize(area, width, height, dpr);

  // 1) flat composition in the print-area frame
  const flat = newCanvas(bw, bh);
  const fctx = flat.getContext("2d");
  if (!fctx) return null;
  for (const el of elements) drawElement(fctx, el, bw, bh, image(el));

  // 2) place on the product surface
  const out = newCanvas(W, H);
  const octx = out.getContext("2d");
  if (!octx) return null;
  octx.imageSmoothingQuality = "high";
  if (area.quad && area.aspect) {
    const q = area.quad.map(([x, y]) => [x * W, y * H]) as Quad;
    warpToQuad(octx, flat, bw, bh, q, 14);
  } else {
    // wrap on a curved surface: per-column resampling (cylinder) + vertical bow
    const curve = area.curve;
    const pad = curve ? Math.ceil(Math.abs(curve.arch) * bh) + 2 : 0;
    const layer = newCanvas(bw, bh + pad * 2);
    const lctx = layer.getContext("2d");
    if (!lctx) return null;
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
    octx.save();
    octx.translate(area.cx * W, area.cy * H);
    octx.rotate((area.rot * Math.PI) / 180);
    octx.drawImage(layer, -bw / 2, -bh / 2 - pad);
    octx.restore();
  }

  // 3) dark surfaces: shade with the photo luminance (grayscale, lifted so the flat surface = 1), clipped to the design
  if (!light && photo) {
    const shade = newCanvas(W, H);
    const hctx = shade.getContext("2d");
    const shaded = newCanvas(W, H);
    const sctx = shaded.getContext("2d");
    if (hctx && sctx) {
      hctx.drawImage(photo, 0, 0, W, H);
      hctx.globalCompositeOperation = "color"; // luminosity only: the surface color must not tint the design
      hctx.fillStyle = "#808080";
      hctx.fillRect(0, 0, W, H);
      hctx.globalCompositeOperation = "lighter"; // Safari has no ctx.filter: lift the mean to white additively
      hctx.fillStyle = `rgba(255,255,255,${clamp(1 - photoMean, 0, 1)})`;
      hctx.fillRect(0, 0, W, H);
      sctx.drawImage(out, 0, 0);
      sctx.globalCompositeOperation = "multiply";
      sctx.drawImage(shade, 0, 0);
      sctx.globalCompositeOperation = "destination-in";
      sctx.drawImage(out, 0, 0);
      return shaded;
    }
  }
  return out;
}

/** Draws the design layer of a zone onto a visible canvas (the page composites it with the photo through CSS blending). */
export function drawZone(canvas: HTMLCanvasElement, opts: DrawOptions) {
  const dpr = opts.dpr ?? Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(opts.width * dpr);
  canvas.height = Math.round(opts.height * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const layer = renderLayer({ ...opts, dpr });
  if (!layer) return;
  ctx.globalAlpha = opts.light ? 0.97 : 0.95; // slightly soft, like ink / thread on fabric
  ctx.drawImage(layer, 0, 0);
}

/* ---------- Offscreen mock-up (final preview, downloads, order previews) ---------- */

export interface MockupSource {
  /** Photo displayed (blank variant preferred when there are elements) — empty for plain frames. */
  photoSrc: string;
  plain: boolean;
  /** Photo pixel size (only the aspect matters). */
  width: number;
  height: number;
  area: AreaGeometry;
  /** Surface color used to decide light / dark compositing (and painted over the sample artwork on flat items). */
  patch: string | null;
  /** The base photo is logo-free: no patch needed. */
  useBlank?: boolean;
  /** Extra patches hiding sample artwork elsewhere on the photo (flat items). */
  masks?: { cx: number; cy: number; w: number; h: number; patch: string }[];
  elements: DesignElement[];
  /** Resolves an element's image URL (uploaded logo / artwork), or null. */
  imageUrl: (el: DesignElement) => string | null;
}

export interface MockupResult {
  canvas: HTMLCanvasElement;
  /** False when a CORS-less image tainted the canvas: it can be shown but not exported. */
  exportable: boolean;
}

/** Renders one zone exactly like the live preview (photo + design) onto a new canvas `width` px wide. */
export async function renderMockup(src: MockupSource, width = 1200): Promise<MockupResult> {
  const height = Math.round(width * (src.height / src.width));
  const imgs = new Map<string, HTMLImageElement>();
  let exportable = true;
  await Promise.all(
    src.elements.map(async (el) => {
      const u = src.imageUrl(el);
      if (!u || imgs.has(u)) return;
      try {
        const img = await loadImage(u);
        imgs.set(u, img);
        if (isTaintedImage(img)) exportable = false;
      } catch {
        // missing image: the element is skipped
      }
    }),
  );
  await ensureFonts(src.elements);
  let photo: HTMLImageElement | null = null;
  if (!src.plain && src.photoSrc) {
    try {
      photo = await loadImage(src.photoSrc);
    } catch {
      photo = null;
    }
  }
  const light = src.plain ? true : isLightHex(src.patch);
  const canvas = newCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return { canvas, exportable: false };
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (photo) {
    ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);
  } else if (src.plain) {
    // plain print-area frame: dashed zone on white
    const a = src.area;
    ctx.strokeStyle = "rgba(10,113,106,0.6)";
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3;
    ctx.strokeRect((a.cx - a.w / 2) * width, a.cy * height - (a.h * width) / 2, a.w * width, a.h * width);
    ctx.setLineDash([]);
  }
  // flat items: hide the sample artwork printed on the photo with surface-colored patches (same look as the live preview)
  if (photo && !src.useBlank && src.elements.length) {
    const soft = (color: string, blur: number) => {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
    };
    for (const m of src.masks ?? []) {
      ctx.fillStyle = m.patch;
      soft(m.patch, Math.max(3, m.h * width * 0.15));
      ctx.beginPath();
      ctx.roundRect(m.cx * width - (m.w * width) / 2, m.cy * height - (m.h * width) / 2, m.w * width, m.h * width, Math.min(m.w, m.h) * width * 0.18);
      ctx.fill();
    }
    if (src.patch) {
      ctx.fillStyle = src.patch;
      soft(src.patch, Math.max(3, src.area.h * width * 0.15));
      if (src.area.quad) {
        ctx.beginPath();
        src.area.quad.forEach(([x, y], i) => (i ? ctx.lineTo(x * width, y * height) : ctx.moveTo(x * width, y * height)));
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(src.area.cx * width, src.area.cy * height);
        ctx.rotate((src.area.rot * Math.PI) / 180);
        ctx.beginPath();
        ctx.roundRect((-src.area.w * width) / 2, (-src.area.h * width) / 2, src.area.w * width, src.area.h * width, Math.min(src.area.w, src.area.h) * width * 0.18);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }
  const layer = renderLayer({
    width,
    height,
    area: src.area,
    light,
    elements: src.elements,
    image: (el) => {
      const u = src.imageUrl(el);
      return u ? imgs.get(u) : null;
    },
    photo,
    photoMean: photo ? meanLuminance(photo) : 0.8,
    dpr: 1,
  });
  if (layer) {
    ctx.globalAlpha = light ? 0.97 : 0.95;
    ctx.globalCompositeOperation = light ? "multiply" : "source-over";
    ctx.drawImage(layer, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
  return { canvas, exportable };
}

/** PNG blob of a canvas, or null when the canvas is tainted / cannot be encoded (never throws). */
export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), "image/png");
    } catch {
      resolve(null);
    }
  });
}
