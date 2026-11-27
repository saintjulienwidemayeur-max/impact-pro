"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ApiError, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Shown to staff who signed in with a temporary password (mustChangePassword) and via the user menu. */
export default function ChangePasswordPage() {
  const { user, status, refresh, logout } = useAuth();
  const router = useRouter();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (status === "guest") router.replace("/login");
  }, [status, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!current) errs.currentPassword = "Saisissez le mot de passe actuel.";
    if (next.length < 12) errs.newPassword = "12 caractères minimum.";
    if (next === current && next) errs.newPassword = "Choisissez un mot de passe différent de l'actuel.";
    if (next !== confirm) errs.confirm = "Les mots de passe ne correspondent pas.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await post("/auth/change-password", { currentPassword: current, newPassword: next });
      await refresh();
      toast.success("Mot de passe modifié.");
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors(err.fieldErrors());
      else if (err instanceof ApiError && err.status === 401) setErrors({ currentPassword: "Mot de passe actuel incorrect." });
      else toast.error(err instanceof ApiError ? err.message : "Échec de la modification.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-gradient-to-br from-ip-teal to-ip-deep p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold">
          <KeyRound className="size-6 text-ip-teal" aria-hidden="true" /> Nouveau mot de passe
        </h1>
        {user?.mustChangePassword && <p className="mt-2 rounded-xl bg-ip-sun/25 p-3 text-sm">Vous utilisez un mot de passe temporaire : choisissez le vôtre pour continuer.</p>}
        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <Field id="cp-current" label="Mot de passe actuel" error={errors.currentPassword} required>
            <Input id="cp-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-invalid={Boolean(errors.currentPassword)} />
          </Field>
          <Field id="cp-new" label="Nouveau mot de passe" hint="12 caractères minimum, difficile à deviner." error={errors.newPassword} required>
            <Input id="cp-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={Boolean(errors.newPassword)} />
          </Field>
          <Field id="cp-confirm" label="Confirmer" error={errors.confirm} required>
            <Input id="cp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={Boolean(errors.confirm)} />
          </Field>
          <Button type="submit" variant="sun" size="lg" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Enregistrer
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => void logout().then(() => router.replace("/login"))}>
            Se déconnecter
          </Button>
        </form>
      </div>
    </main>
  );
}
