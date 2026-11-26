"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { newsletterSchema } from "@/lib/schemas";

export function NewsletterForm() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = newsletterSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Adresse invalide.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? "Inscription impossible pour le moment.");
      }
      toast.success("Merci ! Vous êtes inscrit·e à nos offres.");
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="w-full max-w-lg">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Adresse courriel
        </label>
        <input
          id="newsletter-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Votre adresse courriel"
          aria-invalid={Boolean(error)}
          aria-describedby="newsletter-msg"
          className="h-12 w-full rounded-xl border sm:flex-1 border-white/20 bg-white px-4 text-sm text-ip-ink focus:outline-none focus:ring-2 focus:ring-ip-cyan"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ip-sun px-6 text-sm font-bold uppercase tracking-wide text-ip-ink hover:bg-ip-sun-600 disabled:opacity-70"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          S&apos;inscrire
        </button>
      </div>
      <p id="newsletter-msg" className="mt-2 min-h-4 text-sm text-ip-sun" role={error ? "alert" : undefined}>
        {error ?? ""}
      </p>
    </form>
  );
}
