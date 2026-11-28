"use client";

import "./studio-fonts.css";
import Image from "next/image";
import * as React from "react";
import { RotateCw } from "lucide-react";
import type { Preview } from "@/config/product-media";
import { resolveApiUrl } from "@/lib/api";
import { clamp, SCALE_MAX, SCALE_MIN, type DesignElement } from "@/lib/design";
import { drawZone, elementBox, ensureFonts, isLightHex, loadImage, meanLuminance } from "@/lib/design-render";
import { cssMatrix3d, quadEdges, quadToFlat, scaleQuad, type Quad } from "@/lib/quad";
import { cn } from "@/lib/utils";

interface DesignPreviewProps {
  preview: Preview;
  /** Elements of the zone being shown. */
  elements: DesignElement[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Enables drag / resize / rotate / keyboard editing of the selected element. */
  onChange?: (id: string, patch: Partial<DesignElement>) => void;
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Hide the labels (thumbnails). */
  compact?: boolean;
  /** Zone label for the « aperçu indicatif » note. */
  zoneLabel?: string;
}

const imageUrl = (el: DesignElement) => (el.upload && el.upload.mimeType.startsWith("image/") ? resolveApiUrl(el.upload.url) : null);

type Gesture =
  | { kind: "move"; id: string; sx: number; sy: number; ex: number; ey: number }
  | { kind: "scale"; id: string; startDist: number; startScale: number }
  | { kind: "rotate"; id: string };

export function DesignPreview({ preview, elements, selectedId, onSelect, onChange, sizes, priority, className, compact, zoneLabel }: DesignPreviewProps) {
  const { photo, area, indicative } = preview;
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const areaRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const gesture = React.useRef<Gesture | null>(null);
  const [width, setWidth] = React.useState(0);
  const [imgs, setImgs] = React.useState<Record<string, HTMLImageElement>>({});
  const [base, setBase] = React.useState<{ src: string; img: HTMLImageElement; mean: number } | null>(null);
  const [fontsTick, setFontsTick] = React.useState(0);

  const hasElements = elements.length > 0;
  const useBlank = hasElements && Boolean(photo.blank);
  const baseSrc = photo.plain ? "" : useBlank && photo.blank ? photo.blank : photo.src;

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // uploaded images
  const urlsKey = elements.map(imageUrl).filter(Boolean).join("|");
  React.useEffect(() => {
    let alive = true;
    const urls = urlsKey ? urlsKey.split("|") : [];
    for (const url of urls) {
      loadImage(url)
        .then((img) => alive && setImgs((prev) => (prev[url] === img ? prev : { ...prev, [url]: img })))
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, [urlsKey]);

  // base photo (shading source)
  React.useEffect(() => {
    let alive = true;
    if (!baseSrc || !hasElements) {
      setBase(null);
      return;
    }
    loadImage(baseSrc)
      .then((img) => alive && setBase({ src: baseSrc, img, mean: meanLuminance(img) }))
      .catch(() => alive && setBase(null));
    return () => {
      alive = false;
    };
  }, [baseSrc, hasElements]);

  // fonts used by text elements
  const fontsKey = elements.filter((e) => e.kind === "TEXT").map((e) => `${e.font}:${e.fontWeight}`).join("|");
  React.useEffect(() => {
    let alive = true;
    ensureFonts(elements).then(() => alive && setFontsTick((n) => n + 1));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsKey]);

  const height = width * (photo.height / photo.width);
  const light = isLightHex(area.patch);
  // Perspective areas: the interaction layer is a flat `w × h` box mapped onto the quad with a CSS 3D matrix.
  const quadCss: Quad | null = width > 0 && area.quad && area.aspect ? scaleQuad(area.quad as Quad, width, height) : null;
  let box: { w: number; h: number; left: number; top: number } | null = null;
  if (width > 0) {
    if (quadCss && area.aspect) {
      const e = quadEdges(quadCss);
      const w = (e.top + e.bottom) / 2;
      box = { w, h: w / area.aspect, left: 0, top: 0 };
    } else {
      box = { w: area.w * width, h: area.h * width, left: area.cx * width - (area.w * width) / 2, top: area.cy * height - (area.h * width) / 2 };
    }
  }

  const lookup = React.useCallback((el: DesignElement) => {
    const u = imageUrl(el);
    return u ? imgs[u] : null;
  }, [imgs]);

  const baseReady = photo.plain || Boolean(base && base.src === baseSrc);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || !hasElements || !baseReady) return;
    drawZone(canvas, {
      width,
      height,
      area,
      light: photo.plain ? true : light,
      elements,
      image: lookup,
      photo: photo.plain ? null : base?.img ?? null,
      photoMean: base?.mean ?? 0.8,
    });
  }, [area, base, baseReady, elements, fontsTick, hasElements, height, light, lookup, photo.plain, width]);

  /* ---------- pointer math in the (rotated) print-area frame ---------- */
  function toLocal(clientX: number, clientY: number): { x: number; y: number } | null {
    const node = areaRef.current;
    if (!node || !box) return null;
    if (quadCss) {
      // inverse homography: frame point → flat print-area coordinates (origin moved to the box center)
      const wr = wrapRef.current?.getBoundingClientRect();
      if (!wr) return null;
      const [fx, fy] = quadToFlat(quadCss, box.w, box.h, clientX - wr.left, clientY - wr.top);
      return { x: fx - box.w / 2, y: fy - box.h / 2 };
    }
    const r = node.getBoundingClientRect();
    const dx = clientX - (r.left + r.width / 2);
    const dy = clientY - (r.top + r.height / 2);
    const rad = (area.rot * Math.PI) / 180;
    return { x: dx * Math.cos(rad) + dy * Math.sin(rad), y: -dx * Math.sin(rad) + dy * Math.cos(rad) };
  }

  function beginMove(e: React.PointerEvent, el: DesignElement) {
    onSelect?.(el.id);
    if (!onChange) return;
    const p = toLocal(e.clientX, e.clientY);
    if (!p) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    gesture.current = { kind: "move", id: el.id, sx: p.x, sy: p.y, ex: el.x, ey: el.y };
  }

  function beginScale(e: React.PointerEvent, el: DesignElement) {
    if (!box) return;
    const p = toLocal(e.clientX, e.clientY);
    if (!p) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const cx = el.x * box.w;
    const cy = el.y * box.h;
    gesture.current = { kind: "scale", id: el.id, startDist: Math.max(4, Math.hypot(p.x - cx, p.y - cy)), startScale: el.scale };
  }

  function beginRotate(e: React.PointerEvent, el: DesignElement) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    gesture.current = { kind: "rotate", id: el.id };
  }

  function onMove(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g || !box || !onChange) return;
    const p = toLocal(e.clientX, e.clientY);
    if (!p) return;
    const el = elements.find((x) => x.id === g.id);
    if (!el) return;
    if (g.kind === "move") {
      onChange(g.id, { x: clamp(g.ex + (p.x - g.sx) / box.w, -0.5, 0.5), y: clamp(g.ey + (p.y - g.sy) / box.h, -0.5, 0.5) });
    } else if (g.kind === "scale") {
      const dist = Math.hypot(p.x - el.x * box.w, p.y - el.y * box.h);
      onChange(g.id, { scale: clamp(g.startScale * (dist / g.startDist), SCALE_MIN, SCALE_MAX) });
    } else {
      let deg = (Math.atan2(p.y - el.y * box.h, p.x - el.x * box.w) * 180) / Math.PI + 90;
      if (deg > 180) deg -= 360;
      const snapped = Math.round(deg / 15) * 15;
      onChange(g.id, { rotation: Math.abs(deg - snapped) < 3 ? snapped : Math.round(deg) });
    }
  }

  function onKey(e: React.KeyboardEvent, el: DesignElement) {
    if (!onChange) return;
    const step = e.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const mv = moves[e.key];
    if (mv) {
      e.preventDefault();
      onChange(el.id, { x: clamp(el.x + mv[0], -0.5, 0.5), y: clamp(el.y + mv[1], -0.5, 0.5) });
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      onChange(el.id, { scale: clamp(el.scale * 1.08, SCALE_MIN, SCALE_MAX) });
    } else if (e.key === "-") {
      e.preventDefault();
      onChange(el.id, { scale: clamp(el.scale / 1.08, SCALE_MIN, SCALE_MAX) });
    }
  }

  const canvasReady = hasElements && baseReady;

  return (
    <div
      ref={wrapRef}
      className={cn("relative w-full overflow-hidden bg-white", className)}
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
      data-template={/phone-case-([a-z-]+)\.webp/.exec(photo.src)?.[1]}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onSelect?.(null);
      }}
    >
      {photo.plain ? (
        <div className="absolute inset-0 bg-[linear-gradient(45deg,#f2f6f5_25%,transparent_25%,transparent_75%,#f2f6f5_75%),linear-gradient(45deg,#f2f6f5_25%,#fff_25%,#fff_75%,#f2f6f5_75%)] bg-[length:24px_24px] bg-[position:0_0,12px_12px]" aria-label={photo.alt} role="img">
          {box && (
            <div
              className="absolute rounded-md border-2 border-dashed border-ip-teal/60 bg-white"
              style={{ left: box.left, top: box.top, width: box.w, height: box.h }}
            >
              {!hasElements && !compact && <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs font-semibold text-ip-muted">Zone d&apos;impression</span>}
            </div>
          )}
        </div>
      ) : (
        <Image src={baseSrc || photo.src} alt={photo.alt} fill sizes={sizes ?? "(min-width: 1024px) 50vw, 100vw"} priority={priority} className="object-contain" />
      )}

      {/* Flat items: surface-colored patches hide the sample artwork printed on the photo. */}
      {hasElements &&
        box &&
        !useBlank &&
        !photo.plain &&
        area.masks?.map((m, i) => (
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
      {hasElements && box && !useBlank && !photo.plain && area.patch && quadCss && (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: area.patch, clipPath: `polygon(${quadCss.map(([x, y]) => `${x}px ${y}px`).join(",")})` }}
        />
      )}
      {hasElements && box && !useBlank && !photo.plain && area.patch && !quadCss && (
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

      {hasElements && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          data-testid="design-canvas"
          className="pointer-events-none absolute inset-0 size-full"
          style={{ mixBlendMode: photo.plain || light ? "multiply" : "normal", opacity: canvasReady ? 1 : 0 }}
        />
      )}

      {/* Interaction layer in the print-area frame */}
      {box && hasElements && (
        <div
          ref={areaRef}
          className="absolute"
          style={
            quadCss
              ? { left: 0, top: 0, width: box.w, height: box.h, transformOrigin: "0 0", transform: cssMatrix3d(quadCss, box.w, box.h) }
              : { left: box.left, top: box.top, width: box.w, height: box.h, transform: `rotate(${area.rot}deg)` }
          }
          data-testid="design-overlay"
        >
          {elements.map((el) => {
            const b = elementBox(el, box.w, box.h, lookup(el));
            const selected = el.id === selectedId;
            const label = el.kind === "TEXT" ? `Texte : ${(el.text ?? "").slice(0, 30)}` : `${el.kind === "ARTWORK" ? "Fichier" : "Logo"} : ${el.upload?.originalName ?? ""}`;
            return (
              <div
                key={el.id}
                data-testid={`design-el-${el.kind.toLowerCase()}`}
                data-selected={selected || undefined}
                role={onSelect || onChange ? "button" : undefined}
                tabIndex={onSelect || onChange ? 0 : undefined}
                aria-label={onSelect || onChange ? `${label} (flèches pour déplacer, + et − pour redimensionner)` : undefined}
                aria-pressed={onSelect ? selected : undefined}
                onPointerDown={onSelect || onChange ? (e) => beginMove(e, el) : undefined}
                onPointerMove={onMove}
                onPointerUp={() => (gesture.current = null)}
                onPointerCancel={() => (gesture.current = null)}
                onFocus={() => onSelect?.(el.id)}
                onKeyDown={(e) => onKey(e, el)}
                className={cn("absolute", onChange && "cursor-grab active:cursor-grabbing", !compact && selected && "outline outline-2 outline-dashed outline-ip-teal")}
                style={{
                  left: box.w / 2 + el.x * box.w - b.w / 2,
                  top: box.h / 2 + el.y * box.h - b.h / 2,
                  width: b.w,
                  height: b.h,
                  transform: `rotate(${el.rotation}deg)`,
                  touchAction: selected && onChange ? "none" : "auto",
                  pointerEvents: onSelect || onChange ? "auto" : "none",
                }}
              >
                {onChange && selected && !compact && (
                  <>
                    <span
                      role="slider"
                      aria-label="Redimensionner"
                      aria-valuemin={SCALE_MIN}
                      aria-valuemax={SCALE_MAX}
                      aria-valuenow={Number(el.scale.toFixed(2))}
                      tabIndex={-1}
                      data-testid="handle-scale"
                      onPointerDown={(e) => beginScale(e, el)}
                      onPointerMove={onMove}
                      onPointerUp={() => (gesture.current = null)}
                      className="absolute -bottom-3 -right-3 size-6 cursor-nwse-resize rounded-full border-2 border-white bg-ip-teal shadow"
                      style={{ touchAction: "none" }}
                    />
                    <span
                      role="slider"
                      aria-label="Pivoter"
                      aria-valuemin={-180}
                      aria-valuemax={180}
                      aria-valuenow={Math.round(el.rotation)}
                      tabIndex={-1}
                      data-testid="handle-rotate"
                      onPointerDown={(e) => beginRotate(e, el)}
                      onPointerMove={onMove}
                      onPointerUp={() => (gesture.current = null)}
                      className="absolute -top-9 left-1/2 flex size-6 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-white bg-ip-sun text-ip-ink shadow"
                      style={{ touchAction: "none" }}
                    >
                      <RotateCw className="size-3" aria-hidden="true" />
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(hasElements || indicative) && !compact && !(indicative && !zoneLabel) && (
        <span className="pointer-events-none absolute bottom-2 left-2 max-w-[92%] truncate rounded-full bg-ip-ink/85 px-3 py-1 text-xs font-semibold text-white">
          {indicative && zoneLabel ? `Aperçu indicatif de l'emplacement : ${zoneLabel}` : "Aperçu indicatif"}
        </span>
      )}
    </div>
  );
}
