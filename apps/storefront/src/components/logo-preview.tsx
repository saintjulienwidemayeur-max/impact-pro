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

/**
 * Product photo with the customer's logo composited into the print area.
 * Geometry comes from `print-areas.json`; the sample logo on the photo is masked with the surface color.
 */
export function LogoPreview({ photo, area, logo, params = DEFAULT_PREVIEW, onChange, sizes, priority, className, compact }: LogoPreviewProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const drag = React.useRef<{ x: number; y: number; start: PreviewParams } | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const isImage = Boolean(logo && logo.mimeType.startsWith("image/"));
  const height = width * (photo.height / photo.width);
  const box = area && width > 0
    ? { w: area.w * width, h: area.h * width, left: area.cx * width - (area.w * width) / 2, top: area.cy * height - (area.h * width) / 2 }
    : null;
  const light = isLight(area?.patch ?? null);

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

  return (
    <div
      ref={ref}
      className={cn("relative w-full overflow-hidden bg-white", className)}
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
    >
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes ?? "(min-width: 1024px) 50vw, 100vw"} priority={priority} className="object-contain" />
      {logo &&
        box &&
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
      {logo && box && area && (
        <div
          className="absolute"
          style={{ left: box.left, top: box.top, width: box.w, height: box.h, transform: `rotate(${area.rot}deg)` }}
          data-testid="logo-overlay"
        >
          {area.patch && (
            <div
              className="absolute inset-0 rounded-[18%]"
              style={{ background: area.patch, boxShadow: `0 0 ${Math.max(3, box.h * 0.15)}px ${Math.max(1, box.h * 0.05)}px ${area.patch}` }}
              aria-hidden="true"
            />
          )}
          {isImage ? (
            <div
              className={cn("absolute inset-0 flex items-center justify-center", onChange && "cursor-grab touch-none active:cursor-grabbing")}
              style={{ transform: `translate(${params.dx * box.w}px, ${params.dy * box.h}px)` }}
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
              {/* Remote, user-uploaded logo served by the API: plain <img> (no next/image optimization for this origin). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveApiUrl(logo.url)}
                alt={`Votre logo : ${logo.originalName}`}
                draggable={false}
                className="pointer-events-none max-h-full max-w-full select-none object-contain"
                style={{
                  width: `${params.scale * 100}%`,
                  height: `${params.scale * 100}%`,
                  mixBlendMode: light ? "multiply" : "normal",
                }}
              />
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
