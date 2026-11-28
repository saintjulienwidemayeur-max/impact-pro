"use client";

import * as React from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Copy, Crosshair, MoveDown, MoveUp, Maximize2, Minimize2, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/field";
import {
  FONTS,
  HEX_RE,
  MAX_TEXT_LENGTH,
  MAX_TEXT_LINES,
  SCALE_MAX,
  SCALE_MIN,
  TEXT_COLORS,
  fontById,
  type DesignElement,
} from "@/lib/design";
import { cn } from "@/lib/utils";

interface Props {
  element: DesignElement;
  /** (image aspect) / (area aspect) — lets artwork switch between « Ajuster » and « Remplir ». */
  coverScale?: number | null;
  /** Photo mode (phone cases): a LOGO image can also be switched between « Ajuster » and « Remplir ». */
  photoMode?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (patch: Partial<DesignElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
}

function Slider({ id, label, value, min, max, step, format, onChange }: { id: string; label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div>
      <label htmlFor={id} className="flex justify-between text-sm font-medium">
        {label} <span className="text-ip-muted">{format(value)}</span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-ip-teal" />
    </div>
  );
}

/** Controls for the selected element: text content + font + color, size, rotation, layer actions. */
export function ElementEditor({ element: el, coverScale, photoMode, canMoveUp, canMoveDown, onChange, onDelete, onDuplicate, onMove }: Props) {
  const [hexDraft, setHexDraft] = React.useState(el.color ?? "#000000");
  React.useEffect(() => setHexDraft(el.color ?? "#000000"), [el.color, el.id]);
  const hexValid = HEX_RE.test(hexDraft);
  const font = fontById(el.font);
  const lines = (el.text ?? "").split("\n").length;
  const textRef = React.useRef<HTMLTextAreaElement>(null);

  return (
    <div className="space-y-4 rounded-2xl border border-ip-teal/40 bg-ip-mist/60 p-4" data-testid="element-editor">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">{el.kind === "TEXT" ? "Texte" : el.kind === "ARTWORK" ? "Fichier prêt à imprimer" : "Logo"} sélectionné</p>
        <div className="flex gap-1">
          <button type="button" onClick={() => onMove(1)} disabled={!canMoveUp} aria-label="Placer devant (couche au-dessus)" className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-white disabled:opacity-40">
            <MoveUp className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onMove(-1)} disabled={!canMoveDown} aria-label="Placer derrière (couche en dessous)" className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-white disabled:opacity-40">
            <MoveDown className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={onDuplicate} aria-label="Dupliquer" className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-white">
            <Copy className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={onDelete} aria-label="Supprimer cet élément" data-testid="element-delete" className="inline-flex size-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-50">
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {el.kind === "TEXT" && (
        <>
          <div>
            <label htmlFor="el-text" className="mb-1 flex justify-between text-sm font-medium">
              Votre texte
              <span className={cn("text-xs", (el.text?.length ?? 0) > MAX_TEXT_LENGTH ? "text-red-700" : "text-ip-muted")}>
                {el.text?.length ?? 0}/{MAX_TEXT_LENGTH} · {lines}/{MAX_TEXT_LINES} lignes
              </span>
            </label>
            <Textarea
              id="el-text"
              ref={textRef}
              value={el.text ?? ""}
              maxLength={MAX_TEXT_LENGTH}
              rows={3}
              data-testid="text-input"
              onChange={(e) => {
                const v = e.target.value.split("\n").slice(0, MAX_TEXT_LINES).join("\n");
                onChange({ text: v });
              }}
              className="min-h-20"
              aria-describedby="el-text-hint"
            />
            <p id="el-text-hint" className="mt-1 text-xs text-ip-muted">
              Entrée = nouvelle ligne (6 lignes maximum).
            </p>
          </div>

          <div>
            <p id="lbl-font" className="mb-1.5 text-sm font-medium">
              Police
            </p>
            <div role="radiogroup" aria-labelledby="lbl-font" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={el.font === f.id}
                  onClick={() => onChange({ font: f.id, fontWeight: f.hasBold ? el.fontWeight : "regular" })}
                  data-testid={`font-${f.id}`}
                  className={cn(
                    "h-10 truncate rounded-lg border-2 px-2 text-base",
                    el.font === f.id ? "border-ip-teal bg-white text-ip-teal" : "border-ip-line bg-white hover:border-ip-teal/60",
                  )}
                  style={{ fontFamily: `${f.family}, system-ui, sans-serif` }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {font.hasBold && (
              <button
                type="button"
                aria-pressed={el.fontWeight === "bold"}
                onClick={() => onChange({ fontWeight: el.fontWeight === "bold" ? "regular" : "bold" })}
                className={cn("inline-flex h-10 items-center gap-1.5 rounded-lg border-2 px-3 text-sm font-semibold", el.fontWeight === "bold" ? "border-ip-teal bg-white text-ip-teal" : "border-ip-line bg-white")}
              >
                <Bold className="size-4" aria-hidden="true" /> Gras
              </button>
            )}
            <div role="radiogroup" aria-label="Alignement" className="inline-flex overflow-hidden rounded-lg border-2 border-ip-line bg-white">
              {(
                [
                  ["left", AlignLeft, "Aligné à gauche"],
                  ["center", AlignCenter, "Centré"],
                  ["right", AlignRight, "Aligné à droite"],
                ] as const
              ).map(([v, Icon, label]) => (
                <button key={v} type="button" role="radio" aria-checked={(el.align ?? "center") === v} aria-label={label} onClick={() => onChange({ align: v })} className={cn("inline-flex size-10 items-center justify-center", (el.align ?? "center") === v ? "bg-ip-teal text-white" : "hover:bg-ip-mist")}>
                  <Icon className="size-4" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p id="lbl-color" className="mb-1.5 text-sm font-medium">
              Couleur du texte
            </p>
            <div role="radiogroup" aria-labelledby="lbl-color" className="flex flex-wrap items-center gap-1.5">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={el.color?.toLowerCase() === c.toLowerCase()}
                  aria-label={`Couleur ${c}`}
                  onClick={() => onChange({ color: c })}
                  className={cn("size-8 rounded-full border-2", el.color?.toLowerCase() === c.toLowerCase() ? "border-ip-teal ring-2 ring-ip-cyan/60" : "border-black/15")}
                  style={{ background: c }}
                />
              ))}
              <label className="ml-1 flex items-center gap-1.5 text-xs">
                <span className="sr-only">Couleur personnalisée (hexadécimal)</span>
                <input
                  value={hexDraft}
                  onChange={(e) => {
                    const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                    setHexDraft(v.slice(0, 7));
                    if (HEX_RE.test(v)) onChange({ color: v.toUpperCase() });
                  }}
                  maxLength={7}
                  aria-invalid={!hexValid}
                  aria-label="Couleur personnalisée (hexadécimal)"
                  placeholder="#RRGGBB"
                  data-testid="color-hex"
                  className={cn("h-8 w-24 rounded-lg border px-2 font-mono text-xs", hexValid ? "border-ip-line" : "border-red-500")}
                />
              </label>
            </div>
            {!hexValid && <p className="mt-1 text-xs text-red-700" role="alert">Format attendu : #RRGGBB (ex. #0A716A).</p>}
          </div>
        </>
      )}

      <Slider id="el-scale" label="Taille" value={Math.min(Math.max(el.scale, SCALE_MIN), SCALE_MAX)} min={SCALE_MIN} max={el.kind === "ARTWORK" || photoMode ? Math.max(el.kind === "ARTWORK" ? 2 : 3, coverScale ?? 2) : 3} step={0.01} format={(v) => `${Math.round(v * 100)} %`} onChange={(v) => onChange({ scale: v })} />
      <Slider id="el-rotation" label="Rotation" value={el.rotation} min={-180} max={180} step={1} format={(v) => `${Math.round(v)}°`} onChange={(v) => onChange({ rotation: v })} />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ x: 0, y: 0, rotation: 0 })}>
          <Crosshair aria-hidden="true" /> Centrer
        </Button>
        {(el.kind === "ARTWORK" || (photoMode && el.kind === "LOGO")) && (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ scale: 1, x: 0, y: 0 })} data-testid="artwork-contain">
              <Minimize2 aria-hidden="true" /> Ajuster
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ scale: Math.min(SCALE_MAX, coverScale ?? 1), x: 0, y: 0 })} data-testid="artwork-cover">
              <Maximize2 aria-hidden="true" /> Remplir
            </Button>
          </>
        )}
      </div>
      <p className="text-xs text-ip-muted">Astuce : glissez l&apos;élément sur l&apos;aperçu, utilisez la poignée ronde pour redimensionner et celle du haut pour pivoter.</p>
    </div>
  );
}
