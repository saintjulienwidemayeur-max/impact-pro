"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { friendlyError, resolveApiUrl, uploadLogo, type UploadedLogo } from "@/lib/api";
import { LOGO_ACCEPT, validateLogoFile } from "@/lib/schemas";
import { cn } from "@/lib/utils";

interface LogoUploaderProps {
  id: string;
  value: UploadedLogo | null;
  onChange: (logo: UploadedLogo | null) => void;
  /** External error (e.g. "logo required"). */
  error?: string;
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

/** Drag-and-drop logo upload to `POST /api/v1/uploads/logos`, with progress, error and retry states. */
export function LogoUploader({ id, value, onChange, error }: LogoUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [failure, setFailure] = React.useState<{ message: string; file?: File } | null>(null);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  async function start(file: File) {
    const invalid = validateLogoFile(file);
    if (invalid) {
      setFailure({ message: invalid });
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setFailure(null);
    setProgress(0);
    try {
      const uploaded = await uploadLogo(file, setProgress, ctrl.signal);
      onChange(uploaded);
    } catch (e) {
      if (!ctrl.signal.aborted) setFailure({ message: friendlyError(e), file });
    } finally {
      if (abortRef.current === ctrl) setProgress(null);
    }
  }

  function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) void start(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  const uploading = progress !== null;
  const shownError = failure?.message ?? error;

  return (
    <div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={LOGO_ACCEPT}
        className="sr-only"
        onChange={(e) => onFiles(e.target.files)}
        aria-describedby={`${id}-msg`}
        aria-invalid={Boolean(shownError)}
        data-testid="logo-input"
      />
      {value && !uploading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-ip-teal/40 bg-ip-mist p-3" data-testid="logo-uploaded">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ip-line bg-white">
            {value.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveApiUrl(value.url)} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <FileText className="size-6 text-ip-teal" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ip-teal">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" /> Logo téléversé
            </p>
            <p className="truncate text-xs text-ip-muted">
              {value.originalName} · {formatSize(value.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-ip-teal hover:bg-white"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" /> Remplacer
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Retirer le logo"
            className="inline-flex size-9 items-center justify-center rounded-lg text-ip-muted hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!uploading) onFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors",
            dragOver ? "border-ip-teal bg-ip-teal/5" : "border-ip-line bg-white hover:border-ip-teal hover:bg-ip-mist",
            shownError && "border-red-400",
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="size-8 animate-spin text-ip-teal" aria-hidden="true" />
              <span className="text-sm font-semibold">Téléversement… {progress} %</span>
              <span className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-ip-mist" role="progressbar" aria-valuenow={progress ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Progression du téléversement">
                <span className="block h-full rounded-full bg-ip-teal transition-[width]" style={{ width: `${progress}%` }} />
              </span>
            </>
          ) : (
            <>
              <UploadCloud className="size-8 text-ip-teal" aria-hidden="true" />
              <span className="text-sm font-semibold">
                Glissez votre logo ici ou <span className="text-ip-teal underline">choisissez un fichier</span>
              </span>
              <span className="text-xs text-ip-muted">PNG, JPG, WEBP ou PDF · 10 Mo maximum · fond transparent idéal</span>
            </>
          )}
        </label>
      )}
      <div id={`${id}-msg`} className="mt-1.5 min-h-4 text-xs" role={shownError ? "alert" : undefined}>
        {shownError && (
          <span className="inline-flex items-center gap-1.5 text-red-700">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" /> {shownError}
            {failure?.file && (
              <button type="button" onClick={() => failure.file && void start(failure.file)} className="font-semibold underline">
                Réessayer
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
