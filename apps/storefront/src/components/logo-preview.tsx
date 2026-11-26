"use client";

import Image from "next/image";
import * as React from "react";
import { FileText } from "lucide-react";
import type { PreviewParams } from "./cart-provider";
import type { Photo, PrintArea } from "@/config/product-media";
import { resolveApiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface PreviewLogo {
  url: string;
  mimeType: string;
  originalName: string;
}

interface LogoPreviewProps {
  photo: Photo;
  area: PrintArea | null;
  logo?: PreviewLogo | null;
  params?: PreviewParams;
  /** Enables dragging the logo inside the print area. */
  onChange?: (params: PreviewParams) => void;
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Hide the "Aperçu indicatif" label (e.g. small thumbnails). */
  compact?: boolean;
}

export const DEFAULT_PREVIEW: PreviewParams = { scale: 1, dx: 0, dy: 0 };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function isLight(hex: string | null): boolean {
  if (!hex) return true;
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return true;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => Number.parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image load failed: ${src}`));
    img.src = src;
  });
}

/** Mean luminance (0..1) of the opaque pixels of a same-origin photo, on a tiny canvas (never the tainted one). */
function meanLuminance(img: HTMLImageElement): number {
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

/**
 * Draws the customer's logo into the print area like a real mock-up:
 *  - the logo is wrapped on the surface (cylindrical foreshortening + vertical bow),
 *  - on light products it is multiplied with the (logo-free) photo so folds, shadows and highlights show through,
 *  - on dark products it is shaded with the photo luminance.
 */
function drawLogo(
  canvas: HTMLCanvasElement,
  opts: {
    width: number;
    height: number;
    area: PrintArea;
    light: boolean;
    logo: HTMLImageElement;
    photo: HTMLImageElement;
    photoMean: number;
    params: PreviewParams;
  },
) {
  const { width, height, area, light, logo, photo, photoMean, params } = opts;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bw = Math.max(2, Math.round(area.w * width * dpr)); // box size in device px
  const bh = Math.max(2, Math.round(area.h * width * dpr));

  // 1) flat logo in the print-area frame (contain-fit, scaled, nudged)
  const flat = document.createElement("canvas");
  flat.width = bw;
  flat.height = bh;
  const fctx = flat.getContext("2d");
  if (!fctx) return;
  const fit = Math.min(bw / logo.naturalWidth, bh / logo.naturalHeight) * params.scale;
  const dw = logo.naturalWidth * fit;
  const dh = logo.naturalHeight * fit;
  fctx.imageSmoothingQuality = "high";
  fctx.drawImage(logo, (bw - dw) / 2 + params.dx * bw, (bh - dh) / 2 + params.dy * bh, dw, dh);

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
    const us = (j: number) => {
      const t = (j / bw) * 2 - 1;
      return 0.5 + Math.asin(clamp(t * sinMax, -1, 1)) / (2 * curve.phi);
    };
    for (let j = 0; j < bw; j++) {
      const t = ((j + 0.5) / bw) * 2 - 1;
      const sx0 = us(j) * bw;
      const sx1 = us(j + 1) * bw;
      const sw = Math.max(1, Math.abs(sx1 - sx0));
      const yoff = curve.arch * bh * (1 - t * t);
      lctx.drawImage(flat, Math.min(bw - sw, Math.max(0, Math.min(sx0, sx1))), 0, sw, bh, j, pad + yoff, 1, bh);
    }
  } else {
    lctx.drawImage(flat, 0, pad);
  }

  // 3) dark surfaces: shade the logo with the photo (normalized luminance), clipped to the logo's own alpha
  let final: HTMLCanvasElement = layer;
  if (!light) {
    // Shade map: photo luminance only (grayscale), lifted so the flat surface = 1 and folds/shadows < 1.
    const shade = document.createElement("canvas");
    shade.width = layer.width;
    shade.height = layer.height;
    const hctx = shade.getContext("2d");
    const shaded = document.createElement("canvas");
    shaded.width = layer.width;
    shaded.height = layer.height;
    const sctx = shaded.getContext("2d");
    if (hctx && sctx) {
      hctx.save();
      // photo → box frame (inverse of the box placement transform below)
      hctx.translate(bw / 2, layer.height / 2);
      hctx.rotate((-area.rot * Math.PI) / 180);
      hctx.translate(-area.cx * width * dpr, -area.cy * height * dpr);
      hctx.drawImage(photo, 0, 0, width * dpr, height * dpr);
      hctx.restore();
      hctx.globalCompositeOperation = "color"; // keep luminosity, drop hue/saturation (so the surface color doesn't tint the logo)
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

/**
 * Product photo with the customer's logo composited into the print area.
 * Geometry comes from `print-areas.json`. Products with a logo-free photo (`photo.blank`) get a realistic wrap;
 * flat items (banners, cards…) keep the surface-colored patch that hides the sample artwork.
 */
export function LogoPreview({ photo, area, logo, params = DEFAULT_PREVIEW, onChange, sizes, priority, className, compact }: LogoPreviewProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = React.useState(0);
  const [logoImg, setLogoImg] = React.useState<HTMLImageElement | null>(null);
  const [photoImg, setPhotoImg] = React.useState<{ img: HTMLImageElement; mean: number } | null>(null);
  const drag = React.useRef<{ x: number; y: number; start: PreviewParams } | null>(null);

  const hasLogo = Boolean(logo);
  const baseSrc = hasLogo && photo.blank ? photo.blank : photo.src;
  const useBlank = hasLogo && Boolean(photo.blank);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const isImage = Boolean(logo && logo.mimeType.startsWith("image/"));
  const logoUrl = logo ? resolveApiUrl(logo.url) : null;

  React.useEffect(() => {
    let alive = true;
    setLogoImg(null);
    if (!isImage || !logoUrl) return;
    loadImage(logoUrl)
      .then((img) => alive && setLogoImg(img))
      .catch(() => alive && setLogoImg(null));
    return () => {
      alive = false;
    };
  }, [isImage, logoUrl]);

  React.useEffect(() => {
    let alive = true;
    setPhotoImg(null);
    if (!hasLogo) return;
    loadImage(baseSrc)
      .then((img) => alive && setPhotoImg({ img, mean: meanLuminance(img) }))
      .catch(() => alive && setPhotoImg(null));
    return () => {
      alive = false;
    };
  }, [hasLogo, baseSrc]);

  const height = width * (photo.height / photo.width);
  const box = area && width > 0
    ? { w: area.w * width, h: area.h * width, left: area.cx * width - (area.w * width) / 2, top: area.cy * height - (area.h * width) / 2 }
    : null;
  const light = isLight(area?.patch ?? null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !area || !logoImg || !photoImg || width <= 0) return;
    drawLogo(canvas, { width, height, area, light, logo: logoImg, photo: photoImg.img, photoMean: photoImg.mean, params });
  }, [area, light, logoImg, photoImg, width, height, params]);

  function onPointerDown(e: React.PointerEvent) {
    if (!onChange) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: params };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !box || !area || !onChange) return;
    const rad = (-area.rot * Math.PI) / 180;
    const ddx = e.clientX - drag.current.x;
    const ddy = e.clientY - drag.current.y;
    // Pointer delta expressed in the (rotated) print-area frame.
    const lx = ddx * Math.cos(rad) - ddy * Math.sin(rad);
    const ly = ddx * Math.sin(rad) + ddy * Math.cos(rad);
    onChange({
      ...drag.current.start,
      dx: clamp(drag.current.start.dx + lx / box.w, -0.5, 0.5),
      dy: clamp(drag.current.start.dy + ly / box.h, -0.5, 0.5),
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!onChange) return;
    const step = e.shiftKey ? 0.1 : 0.03;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const mv = moves[e.key];
    if (!mv) return;
    e.preventDefault();
    onChange({ ...params, dx: clamp(params.dx + mv[0], -0.5, 0.5), dy: clamp(params.dy + mv[1], -0.5, 0.5) });
  }

  const canvasReady = Boolean(isImage && logoImg && photoImg);

  return (
    <div
      ref={ref}
      className={cn("relative w-full overflow-hidden bg-white", className)}
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
    >
      <Image src={baseSrc} alt={photo.alt} fill sizes={sizes ?? "(min-width: 1024px) 50vw, 100vw"} priority={priority} className="object-contain" />

      {/* Flat items: surface-colored patches hide the sample artwork printed on the photo. */}
      {logo &&
        box &&
        !useBlank &&
        area?.masks?.map((m, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="absolute rounded-[18%]"
            style={{
              left: m.cx * width - (m.w * width) / 2,
              top: m.cy * height - (m.h * width) / 2,
              width: m.w * width,
              height: m.h * width,
              background: m.patch,
              boxShadow: `0 0 ${Math.max(3, m.h * width * 0.15)}px ${Math.max(1, m.h * width * 0.05)}px ${m.patch}`,
            }}
          />
        ))}
      {logo && box && area && !useBlank && area.patch && (
        <div
          aria-hidden="true"
          className="absolute rounded-[18%]"
          style={{
            left: box.left,
            top: box.top,
            width: box.w,
            height: box.h,
            transform: `rotate(${area.rot}deg)`,
            background: area.patch,
            boxShadow: `0 0 ${Math.max(3, box.h * 0.15)}px ${Math.max(1, box.h * 0.05)}px ${area.patch}`,
          }}
        />
      )}

      {/* Rendered logo (canvas). Light surfaces multiply with the photo underneath so the shading shows through. */}
      {logo && isImage && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          data-testid="logo-canvas"
          className="pointer-events-none absolute inset-0 size-full"
          style={{ mixBlendMode: light ? "multiply" : "normal", opacity: canvasReady ? 1 : 0 }}
        />
      )}

      {/* Interaction layer (drag / arrow keys) and PDF placeholder, positioned on the print area. */}
      {logo && box && area && (
        <div
          className="absolute"
          style={{ left: box.left, top: box.top, width: box.w, height: box.h, transform: `rotate(${area.rot}deg)` }}
          data-testid="logo-overlay"
        >
          {isImage ? (
            <div
              className={cn("absolute inset-0", onChange && "cursor-grab touch-none active:cursor-grabbing")}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onKeyDown={onKeyDown}
              tabIndex={onChange ? 0 : undefined}
              role={onChange ? "slider" : undefined}
              aria-label={onChange ? "Position du logo (flèches pour déplacer)" : undefined}
              aria-valuetext={onChange ? `Décalage horizontal ${Math.round(params.dx * 100)} %, vertical ${Math.round(params.dy * 100)} %` : undefined}
            >
              <span className="sr-only">{`Votre logo : ${logo.originalName}`}</span>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-1">
              <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-ip-ink/85 px-2 py-1 text-[10px] font-semibold text-white">
                <FileText className="size-3 shrink-0" aria-hidden="true" /> PDF
              </span>
            </div>
          )}
        </div>
      )}
      {logo && !compact && (
        <span className="absolute bottom-2 left-2 rounded-full bg-ip-ink/85 px-3 py-1 text-xs font-semibold text-white">Aperçu indicatif</span>
      )}
    </div>
  );
}
