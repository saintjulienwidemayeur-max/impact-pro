"use client";

import { AlertTriangle, Check, ChevronLeft, ChevronRight, Copy, Inbox, Loader2, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import type { Meta } from "@/lib/types";
import type { Tone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const TONES: Record<Tone, string> = {
  gray: "bg-gray-100 text-gray-700",
  teal: "bg-ip-teal/10 text-ip-teal",
  cyan: "bg-ip-cyan/20 text-[#0b6a8a]",
  sun: "bg-ip-sun/30 text-[#7a5800]",
  red: "bg-red-100 text-red-800",
  green: "bg-emerald-100 text-emerald-800",
  ink: "bg-ip-ink text-white",
};

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone], className)}>{children}</span>;
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-ip-line bg-white p-4 sm:p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-ip-mist", className)} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Chargement" className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-9" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ip-line bg-white px-6 py-12 text-center">
      <Inbox className="size-8 text-ip-muted" aria-hidden="true" />
      <p className="font-heading text-lg font-semibold">{title}</p>
      {text && <p className="max-w-md text-sm text-ip-muted">{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <AlertTriangle className="size-8 text-red-700" aria-hidden="true" />
      <p className="max-w-md text-sm text-red-900">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ip-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Pagination({ meta, onPage }: { meta: Meta | null; onPage: (p: number) => void }) {
  if (!meta || meta.totalPages <= 1) return meta ? <p className="mt-3 text-xs text-ip-muted">{meta.total} résultat(s)</p> : null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span className="text-ip-muted">
        Page {meta.page} / {meta.totalPages} · {meta.total} résultats
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Page précédente">
          <ChevronLeft /> Précédent
        </Button>
        <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)} aria-label="Page suivante">
          Suivant <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}

/** Native <dialog>: focus trap, Escape and backdrop handled by the browser. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  testId?: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      data-testid={testId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn("m-auto w-[calc(100%-2rem)] rounded-2xl border border-ip-line bg-white p-0 text-ip-ink shadow-2xl backdrop:bg-black/50", wide ? "max-w-3xl" : "max-w-lg")}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-ip-line px-5 py-3">
            <h2 className="font-heading text-lg font-bold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 hover:bg-ip-mist">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ip-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmer",
  danger,
  busy,
  children,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  children?: React.ReactNode;
  testId?: string;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      testId={testId}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button variant={danger ? "ink" : "teal"} onClick={onConfirm} disabled={busy} data-testid="confirm-ok">
            {busy && <Loader2 className="animate-spin" />} {confirmLabel}
          </Button>
        </>
      }
    >
      {message && <p className="text-sm text-ip-muted">{message}</p>}
      {children}
    </Dialog>
  );
}

export function CopyButton({ value, label = "Copier", className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          window.setTimeout(() => setDone(false), 2000);
        } catch {
          toast.error("Copie impossible : sélectionnez le texte manuellement.");
        }
      }}
    >
      {done ? <Check /> : <Copy />} {done ? "Copié" : label}
    </Button>
  );
}

export function Stat({ label, value, hint, tone = "teal" }: { label: string; value: React.ReactNode; hint?: string; tone?: "teal" | "sun" | "red" | "cyan" }) {
  const bar = { teal: "bg-ip-teal", sun: "bg-ip-sun", red: "bg-red-600", cyan: "bg-ip-cyan" }[tone];
  return (
    <Card className="relative overflow-hidden">
      <span className={cn("absolute inset-y-0 left-0 w-1.5", bar)} aria-hidden="true" />
      <p className="text-xs font-semibold uppercase tracking-wide text-ip-muted">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ip-muted">{hint}</p>}
    </Card>
  );
}

/** Horizontal bars, no dependency. */
export function BarList({ rows, format }: { rows: { label: string; value: number; tone?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_auto]">
          <span className="truncate text-ip-muted">{r.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-ip-mist">
            <span className={cn("block h-full rounded-full", r.tone ?? "bg-ip-teal")} style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="w-16 text-right font-semibold tabular-nums">{format ? format(r.value) : r.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Responsive table wrapper: horizontal scroll on phones, sticky header look. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-ip-line bg-white">
      <table className="w-full min-w-[40rem] text-left text-sm">{children}</table>
    </div>
  );
}
export const Th = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <th scope="col" className={cn("whitespace-nowrap border-b border-ip-line bg-ip-mist px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ip-muted", className)}>
    {children}
  </th>
);
export const Td = ({ children, className, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("border-b border-ip-line/70 px-3 py-2.5 align-middle", className)} {...rest}>
    {children}
  </td>
);
