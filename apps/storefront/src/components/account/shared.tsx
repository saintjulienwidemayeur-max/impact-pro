"use client";

import * as React from "react";
import { Eye, EyeOff, Package, ShieldCheck, Sparkles } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** A redirect target is accepted only when it is a path on this site (no open redirect). */
export function safeNext(next: string | null | undefined, fallback = "/compte"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

interface PasswordFieldProps {
  id: string;
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
  hint?: string;
  required?: boolean;
  /** Notified on every change. The input stays UNCONTROLLED so text typed before hydration is never lost. */
  onChange?: (value: string) => void;
}

/** Password input with a show / hide toggle (keyboard and screen-reader friendly). */
export function PasswordField({ id, name, label, autoComplete, error, hint, required, onChange }: PasswordFieldProps) {
  const [visible, setVisible] = React.useState(false);
  return (
    <Field id={id} label={label} error={error} hint={hint} required={required}>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-msg`}
          className="pr-12"
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          autoCapitalize="none"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute right-1.5 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-ip-muted hover:bg-ip-mist hover:text-ip-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ip-cyan"
        >
          {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </div>
    </Field>
  );
}

/** Strength meter + checklist under the « new password » field. */
export function PasswordStrength({ score, items }: { score: 0 | 1 | 2 | 3; items: { label: string; ok: boolean }[] }) {
  const labels = ["Trop faible", "Correct", "Bon", "Excellent"];
  const colors = ["bg-red-500", "bg-ip-sun", "bg-ip-cyan", "bg-ip-teal"];
  return (
    <div className="space-y-2" data-testid="password-strength">
      <div className="flex items-center gap-2" aria-live="polite">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn("h-1.5 flex-1 rounded-full bg-ip-line transition-colors", i <= score && colors[score])} />
          ))}
        </div>
        <span className="w-20 text-right text-xs font-medium text-ip-muted">{labels[score]}</span>
      </div>
      <ul className="grid gap-1 text-xs text-ip-muted sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.label} className={cn("flex items-center gap-1.5", i.ok && "text-ip-teal")}>
            <span className={cn("inline-block size-1.5 rounded-full", i.ok ? "bg-ip-teal" : "bg-ip-line")} aria-hidden="true" />
            {i.label}
            <span className="sr-only">{i.ok ? " : ok" : " : à remplir"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Two-column layout of the sign-in / sign-up pages: the form card + a brand panel with the benefits of an account. */
export function AuthShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="container-ip grid gap-8 py-10 lg:grid-cols-[minmax(0,520px)_1fr] lg:gap-12 lg:py-14">
      <div className="rounded-[var(--radius-card)] border border-ip-line bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="mt-1 text-sm text-ip-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
      <aside className="relative hidden overflow-hidden rounded-[var(--radius-card)] bg-ip-teal p-8 text-white lg:block">
        <svg className="pointer-events-none absolute -bottom-24 -right-24 h-[380px] w-[380px]" viewBox="0 0 600 600" aria-hidden="true">
          <circle cx="300" cy="300" r="250" fill="none" stroke="white" strokeOpacity="0.07" strokeWidth="80" />
        </svg>
        <h2 className="relative text-2xl font-bold">Votre espace client Impact Pro</h2>
        <ul className="relative mt-6 space-y-5">
          {[
            { icon: Package, title: "Suivez vos commandes", text: "Statut, maquettes et livraison de chaque commande, au même endroit." },
            { icon: Sparkles, title: "Retrouvez vos créations", text: "Vos aperçus restent attachés à vos commandes pour recommander plus vite." },
            { icon: ShieldCheck, title: "Vos données protégées", text: "Mot de passe chiffré, session sécurisée : vous seul accédez à vos commandes." },
          ].map(({ icon: Icon, title: t, text }) => (
            <li key={t} className="flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Icon className="size-5 text-ip-sun" aria-hidden="true" />
              </span>
              <span>
                <span className="block font-semibold">{t}</span>
                <span className="block text-sm text-white/80">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="relative mt-8 flex h-2 overflow-hidden rounded-full">
          <span className="flex-[3] bg-ip-cyan" />
          <span className="flex-1 bg-ip-sun" />
        </div>
      </aside>
    </div>
  );
}
