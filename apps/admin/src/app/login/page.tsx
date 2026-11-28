"use client";

import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login, status, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (status === "staff") router.replace(user?.mustChangePassword ? "/changer-mot-de-passe" : "/");
  }, [status, user?.mustChangePassword, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const me = await login(email.trim(), password);
      router.replace(me.mustChangePassword ? "/changer-mot-de-passe" : "/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403)
        setError(err.code === "ORIGIN_NOT_ALLOWED" ? "Configuration serveur : l'origine de ce site n'est pas autorisée par l'API (CORS_ORIGINS)." : "Accès réservé à l'équipe Impact Pro.");
      else if (err instanceof ApiError && err.status === 401) setError("E-mail ou mot de passe incorrect.");
      else if (err instanceof ApiError && err.status === 429) setError("Trop de tentatives. Patientez quelques minutes avant de réessayer.");
      else setError(err instanceof ApiError ? err.message : "Connexion impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-gradient-to-br from-ip-teal to-ip-deep p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <Image src="/brand/logo-impact-pro.png" alt="Impact Pro" width={190} height={60} priority className="mx-auto h-14 w-auto" />
        <h1 className="mt-5 text-center font-heading text-2xl font-bold">Administration</h1>
        <p className="mt-1 text-center text-sm text-ip-muted">Espace réservé à l&apos;équipe Impact Pro.</p>
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <Field id="email" label="E-mail" required>
            <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field id="password" label="Mot de passe" required>
            <div className="relative">
              <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-11" />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ip-muted hover:bg-ip-mist">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          {error && (
            <p role="alert" data-testid="login-error" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}
          <Button type="submit" variant="sun" size="lg" className="w-full" disabled={busy || !email || !password}>
            {busy ? <Loader2 className="animate-spin" /> : <LogIn />} Se connecter
          </Button>
        </form>
        <p className="mt-5 text-center text-xs text-ip-muted">Mot de passe oublié ? Demandez une réinitialisation à un super administrateur.</p>
      </div>
    </main>
  );
}
