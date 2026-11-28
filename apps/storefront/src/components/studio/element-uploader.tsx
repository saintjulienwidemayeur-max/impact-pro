"use client";

import * as React from "react";
import { AlertCircle, FileUp, ImagePlus, Loader2 } from "lucide-react";
import { BackgroundDialog } from "./background-dialog";
import { Button } from "../ui/button";
import { friendlyError, uploadArtwork, uploadLogo, type UploadedLogo } from "@/lib/api";
import { LOGO_ACCEPT, MAX_ARTWORK_BYTES, MAX_UPLOAD_BYTES, validateLogoFile } from "@/lib/schemas";
import type { UploadRef } from "@/lib/design";

interface Props {
  kind: "LOGO" | "ARTWORK";
  disabled?: boolean;
  /** Visually emphasized (e.g. artwork-required products). */
  primary?: boolean;
  /** Phone cases: « Ajouter ma photo » — the photo fills the whole print area, no background removal. */
  photoMode?: boolean;
  onUploaded: (upload: UploadRef) => void;
}

const toRef = (u: UploadedLogo): UploadRef => ({ id: u.id, url: u.url, mimeType: u.mimeType, originalName: u.originalName, width: u.width, height: u.height });

/**
 * Adds a logo (image → background-removal dialog first, PDF → straight upload) or a ready-to-print artwork file
 * (POST /uploads/logos, resp. /uploads/artwork) with progress, error and retry.
 */
export function ElementUploader({ kind, disabled, primary, photoMode, onUploaded }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const [pending, setPending] = React.useState<File | null>(null); // image waiting for the background dialog
  const [progress, setProgress] = React.useState<number | null>(null);
  const [failure, setFailure] = React.useState<{ message: string; file: File } | null>(null);
  const isLogo = kind === "LOGO";
  const maxBytes = isLogo ? MAX_UPLOAD_BYTES : MAX_ARTWORK_BYTES;

  React.useEffect(() => () => abortRef.current?.abort(), []);

  async function upload(file: File) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setFailure(null);
    setProgress(0);
    try {
      const res = await (isLogo ? uploadLogo : uploadArtwork)(file, setProgress, ctrl.signal);
      onUploaded(toRef(res));
    } catch (e) {
      if (!ctrl.signal.aborted) setFailure({ message: friendlyError(e), file });
    } finally {
      if (abortRef.current === ctrl) setProgress(null);
    }
  }

  function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    const invalid = validateLogoFile(file, maxBytes);
    if (invalid) {
      setFailure({ message: invalid, file });
      return;
    }
    setFailure(null);
    if (isLogo && !photoMode && file.type.startsWith("image/")) setPending(file);
    else void upload(file);
  }

  const uploading = progress !== null;
  const Icon = isLogo ? ImagePlus : FileUp;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={LOGO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => onFiles(e.target.files)}
        data-testid={isLogo ? "logo-input" : "artwork-input"}
        aria-label={photoMode ? "Choisir ma photo" : isLogo ? "Choisir un logo" : "Choisir votre fichier prêt à imprimer"}
      />
      <Button
        type="button"
        variant={primary ? "sun" : "outline"}
        size="md"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        className={primary ? "w-full" : undefined}
        data-testid={photoMode ? "add-photo" : isLogo ? "add-logo" : "add-artwork"}
      >
        {uploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Icon aria-hidden="true" />}
        {uploading ? `Téléversement… ${progress} %` : photoMode ? "Ajouter ma photo" : isLogo ? "Ajouter un logo" : "Importer mon fichier prêt à imprimer"}
      </Button>
      {uploading && (
        <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-ip-mist" role="progressbar" aria-valuenow={progress ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Progression du téléversement">
          <span className="block h-full rounded-full bg-ip-teal transition-[width]" style={{ width: `${progress}%` }} />
        </span>
      )}
      {!uploading && (
        <p className="mt-1 text-[11px] text-ip-muted">
          {photoMode ? "Votre photo remplit tout le dos de la coque · JPG ou PNG, 10 Mo max." : isLogo ? "PNG, JPG, WEBP ou PDF · 10 Mo max." : "PNG, JPG, WEBP ou PDF · 25 Mo max."}
        </p>
      )}
      {failure && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-red-700" role="alert">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" /> {failure.message}
          {!validateLogoFile(failure.file, maxBytes) && (
            <button type="button" onClick={() => void upload(failure.file)} className="font-semibold underline">
              Réessayer
            </button>
          )}
        </p>
      )}
      {pending && (
        <BackgroundDialog
          file={pending}
          onCancel={() => setPending(null)}
          onConfirm={(f) => {
            setPending(null);
            void upload(f);
          }}
        />
      )}
    </div>
  );
}
