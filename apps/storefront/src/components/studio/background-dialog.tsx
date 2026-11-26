"use client";

import * as React from "react";
import { Loader2, Pipette, RotateCcw, Undo2, X } from "lucide-react";
import { Button } from "../ui/button";
import {
  analyzeBorder,
  contentBounds,
  cropImage,
  DEFAULT_TOLERANCE,
  removeBackground,
  type RemoveOptions,
  type Rgb,
  type RgbaImage,
} from "@/lib/bg-removal";
import { cn } from "@/lib/utils";

const MAX_WORK = 1600;

interface Settings {
  enabled: boolean;
  mode: "edge" | "global";
  tolerance: number;
  feather: number;
  bg: Rgb | null;
}

interface Props {
  file: File;
  /** Called with the file to upload: a transparent PNG, or the untouched original when the switch is off. */
  onConfirm: (file: File) => void;
  onCancel: () => void;
}

const hex = (c: Rgb) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

function toPng(img: RgbaImage): Promise<Blob | null> {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return new Promise((resolve) => c.toBlob(resolve, "image/png"));
}

/** « Retirer l'arrière-plan » dialog: runs entirely in the browser (canvas), nothing is uploaded until the user confirms. */
export function BackgroundDialog({ file, onConfirm, onCancel }: Props) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const previewRef = React.useRef<HTMLCanvasElement>(null);
  const [src, setSrc] = React.useState<RgbaImage | null>(null);
  const [auto, setAuto] = React.useState<{ color: Rgb; uniform: boolean; transparent: boolean } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<Settings>({ enabled: true, mode: "edge", tolerance: DEFAULT_TOLERANCE, feather: 1, bg: null });
  const [history, setHistory] = React.useState<Settings[]>([]);
  const [pipette, setPipette] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  // decode + downscale the working copy
  React.useEffect(() => {
    let alive = true;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      const k = Math.min(1, MAX_WORK / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k));
      const h = Math.max(1, Math.round(img.naturalHeight * k));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        setError("Votre navigateur ne permet pas de traiter cette image.");
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const rgba: RgbaImage = { data: data.data, width: w, height: h };
      const a = analyzeBorder(rgba);
      setSrc(rgba);
      setAuto(a);
      setSettings((s) => ({ ...s, enabled: a.uniform && !a.transparent }));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      if (alive) setError("Impossible de lire cette image. Essayez un autre fichier.");
      URL.revokeObjectURL(url);
    };
    img.src = url;
    return () => {
      alive = false;
    };
  }, [file]);

  const options: RemoveOptions | null = React.useMemo(
    () => (src && auto ? { mode: settings.mode, tolerance: settings.tolerance, feather: settings.feather, bg: settings.bg ?? auto.color } : null),
    [src, auto, settings.mode, settings.tolerance, settings.feather, settings.bg],
  );

  // live preview (debounced)
  React.useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !src || !options) return;
    const t = window.setTimeout(() => {
      const out = settings.enabled ? removeBackground(src, options) : src;
      canvas.width = out.width;
      canvas.height = out.height;
      canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(out.data), out.width, out.height), 0, 0);
    }, 40);
    return () => window.clearTimeout(t);
  }, [src, options, settings.enabled]);

  function change(patch: Partial<Settings>) {
    setHistory((h) => [...h.slice(-19), settings]);
    setSettings((s) => ({ ...s, ...patch }));
  }

  function undo() {
    setHistory((h) => {
      const prev = h[h.length - 1];
      if (prev) setSettings(prev);
      return h.slice(0, -1);
    });
  }

  function reset() {
    setHistory([]);
    setSettings({ enabled: Boolean(auto?.uniform && !auto.transparent), mode: "edge", tolerance: DEFAULT_TOLERANCE, feather: 1, bg: null });
    setPipette(false);
  }

  function pick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!pipette || !src) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(src.width - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * src.width)));
    const y = Math.min(src.height - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * src.height)));
    const i = (y * src.width + x) * 4;
    change({ bg: [src.data[i], src.data[i + 1], src.data[i + 2]], enabled: true });
    setPipette(false);
  }

  async function confirm() {
    if (!src || !options) return;
    if (!settings.enabled) {
      onConfirm(file);
      return;
    }
    setBusy(true);
    try {
      let out = removeBackground(src, options);
      const b = contentBounds(out);
      if (b) out = cropImage(out, b);
      const blob = await toPng(out);
      if (!blob) throw new Error("PNG export failed");
      const base = file.name.replace(/\.[^.]+$/, "") || "logo";
      onConfirm(new File([blob], `${base}.png`, { type: "image/png" }));
    } catch {
      setError("Le retrait de l'arrière-plan a échoué. Vous pouvez envoyer le logo tel quel.");
      setBusy(false);
    }
  }

  const bgColor = settings.bg ?? auto?.color ?? [255, 255, 255];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="bg-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(96vw,720px)] max-h-[94vh] overflow-y-auto rounded-3xl border border-ip-line bg-white p-0 text-ip-ink shadow-2xl backdrop:bg-ip-ink/60"
      data-testid="bg-dialog"
    >
      <div className="flex items-start justify-between gap-3 border-b border-ip-line p-5">
        <div>
          <h2 id="bg-title" className="text-xl font-bold">
            Retirer l&apos;arrière-plan du logo
          </h2>
          <p className="mt-0.5 text-sm text-ip-muted">{file.name}</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Fermer" className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-ip-mist">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-[1.2fr_1fr]">
        <div>
          <div
            className={cn(
              "relative flex min-h-56 items-center justify-center overflow-hidden rounded-2xl border border-ip-line p-2",
              "bg-[linear-gradient(45deg,#e8eeed_25%,transparent_25%,transparent_75%,#e8eeed_75%),linear-gradient(45deg,#e8eeed_25%,#fff_25%,#fff_75%,#e8eeed_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]",
            )}
          >
            {!src && !error && <Loader2 className="size-8 animate-spin text-ip-teal" aria-label="Chargement de l'image" />}
            <canvas
              ref={previewRef}
              onClick={pick}
              data-testid="bg-preview"
              aria-label="Aperçu du logo sur fond à damier"
              className={cn("max-h-[46vh] max-w-full object-contain", !src && "hidden", pipette && "cursor-crosshair")}
            />
          </div>
          <p className="mt-2 text-xs text-ip-muted">
            Le damier gris/blanc représente la transparence. Le traitement se fait dans votre navigateur ; seul le résultat est envoyé.
          </p>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-xl bg-ip-mist p-3 text-sm font-semibold">
            <span>Retirer l&apos;arrière-plan</span>
            <input
              type="checkbox"
              role="switch"
              checked={settings.enabled}
              onChange={(e) => change({ enabled: e.target.checked })}
              disabled={!src}
              data-testid="bg-switch"
              className="size-5 accent-ip-teal"
            />
          </label>
          {auto?.transparent && <p className="text-xs text-ip-muted">Votre image a déjà un fond transparent : rien à retirer.</p>}
          {auto && !auto.uniform && !auto.transparent && (
            <p className="text-xs text-amber-800">Le fond n&apos;est pas uni : utilisez la pipette sur la couleur à retirer et ajustez la tolérance.</p>
          )}

          <fieldset disabled={!settings.enabled || !src} className="space-y-4 disabled:opacity-50">
            <div>
              <label htmlFor="bg-tol" className="flex justify-between text-sm font-medium">
                Tolérance <span className="text-ip-muted">{settings.tolerance}</span>
              </label>
              <input id="bg-tol" type="range" min={0} max={100} value={settings.tolerance} onChange={(e) => change({ tolerance: Number(e.target.value) })} className="w-full accent-ip-teal" />
            </div>
            <div>
              <label htmlFor="bg-feather" className="flex justify-between text-sm font-medium">
                Lissage des bords <span className="text-ip-muted">{settings.feather}</span>
              </label>
              <input id="bg-feather" type="range" min={0} max={10} value={settings.feather} onChange={(e) => change({ feather: Number(e.target.value) })} className="w-full accent-ip-teal" />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={settings.mode === "global"} onChange={(e) => change({ mode: e.target.checked ? "global" : "edge" })} className="mt-0.5 size-4 accent-ip-teal" />
              <span>
                Supprimer cette couleur partout
                <span className="block text-xs text-ip-muted">Sinon, seul le fond relié aux bords est retiré (le blanc à l&apos;intérieur des lettres est conservé).</span>
              </span>
            </label>
            <div className="flex items-center gap-3">
              <Button type="button" variant={pipette ? "teal" : "outline"} size="sm" onClick={() => setPipette((p) => !p)} aria-pressed={pipette} data-testid="bg-pipette">
                <Pipette aria-hidden="true" /> Pipette
              </Button>
              <span className="inline-flex items-center gap-2 text-xs text-ip-muted">
                <span className="size-5 rounded border border-black/20" style={{ background: hex(bgColor as Rgb) }} aria-hidden="true" />
                Couleur retirée {hex(bgColor as Rgb)}
              </span>
            </div>
            {pipette && <p className="text-xs text-ip-teal">Cliquez sur la couleur du fond dans l&apos;aperçu.</p>}
          </fieldset>

          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={undo} disabled={history.length === 0}>
              <Undo2 aria-hidden="true" /> Annuler
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={!src}>
              <RotateCcw aria-hidden="true" /> Réinitialiser
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <p className="mx-5 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-ip-line p-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        {error && (
          <Button type="button" variant="outline" onClick={() => onConfirm(file)}>
            Envoyer tel quel
          </Button>
        )}
        <Button type="button" variant="sun" onClick={() => void confirm()} disabled={(!src && !error) || busy} data-testid="bg-confirm">
          {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
          {settings.enabled ? "Utiliser ce logo sans fond" : "Utiliser le logo tel quel"}
        </Button>
      </div>
    </dialog>
  );
}
