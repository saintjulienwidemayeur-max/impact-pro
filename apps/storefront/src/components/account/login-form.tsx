"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import { useAuth } from "../auth-provider";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/field";
import { PasswordField, safeNext } from "./shared";
import { accountErrorMessage } from "@/lib/account-api";
import { fieldErrors, loginSchema } from "@/lib/schemas";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { status, login } = useAuth();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [general, setGeneral] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // Already signed in: skip the form.
  React.useEffect(() => {
    if (status === "authenticated" && !pending) router.replace(next);
  }, [status, pending, next, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({ email: data.get("email")?.toString() ?? "", password: data.get("password")?.toString() ?? "" });
    setGeneral(null);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      (e.currentTarget.elements.namedItem(Object.keys(errs)[0]) as HTMLElement | null)?.focus();
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const user = await login(parsed.data.email, parsed.data.password);
      toast.success(`Bienvenue${user.fullName ? `, ${user.fullName.split(" ")[0]}` : ""} !`);
      router.replace(next);
    } catch (err) {
      setGeneral(accountErrorMessage(err));
      setPending(false);
    }
  }

  const registerHref = `/inscription${next !== "/compte" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="login-form">
      <Field id="email" label="E-mail" required error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" aria-invalid={Boolean(errors.email)} aria-describedby="email-msg" />
      </Field>
      <PasswordField id="password" name="password" label="Mot de passe" autoComplete="current-password" required error={errors.password} />
      {general && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800" data-testid="login-error">
          {general}
        </p>
      )}
      <Button type="submit" variant="sun" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href="/mot-de-passe-oublie" className="font-medium text-ip-teal underline-offset-2 hover:underline">
          Mot de passe oublié ?
        </Link>
        <span className="text-ip-muted">
          Pas encore de compte ?{" "}
          <Link href={registerHref} className="font-semibold text-ip-teal underline-offset-2 hover:underline">
            Créer un compte
          </Link>
        </span>
      </div>
    </form>
  );
}
