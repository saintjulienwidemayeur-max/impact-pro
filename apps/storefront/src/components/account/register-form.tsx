"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { useAuth } from "../auth-provider";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/field";
import { PasswordField, PasswordStrength, safeNext } from "./shared";
import { accountErrorMessage, accountFieldErrors, claimOrder, passwordHints } from "@/lib/account-api";
import { fieldErrors, registerSchema } from "@/lib/schemas";

const FIELDS = ["fullName", "email", "phone", "password", "acceptTerms"] as const;

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const presetEmail = params.get("email") ?? "";
  const claimRef = params.get("ref") ?? "";
  const { status, register } = useAuth();
  const [email, setEmail] = React.useState(presetEmail);
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [general, setGeneral] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (status === "authenticated" && !pending) router.replace(next);
  }, [status, pending, next, router]);

  const hints = passwordHints(password, email);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const values = {
      fullName: data.get("fullName")?.toString() ?? "",
      email: data.get("email")?.toString() ?? "",
      phone: data.get("phone")?.toString() ?? "",
      password: data.get("password")?.toString() ?? "",
      acceptTerms: data.get("acceptTerms") === "on",
    };
    setGeneral(null);
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      (form.elements.namedItem(Object.keys(errs)[0]) as HTMLElement | null)?.focus();
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const user = await register({
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone || undefined,
        password: parsed.data.password,
        acceptTerms: true,
      });
      // Coming from an order confirmation: attach that guest order to the new account (best effort).
      if (claimRef && presetEmail.toLowerCase() === user.email) {
        try {
          if (await claimOrder(claimRef, presetEmail)) toast.success("Votre commande a été ajoutée à votre compte.");
        } catch {
          /* the account exists either way */
        }
      }
      toast.success("Compte créé. Bienvenue chez Impact Pro !");
      router.replace(next);
    } catch (err) {
      const fields = accountFieldErrors(err);
      const known = Object.fromEntries(Object.entries(fields).filter(([k]) => (FIELDS as readonly string[]).includes(k)));
      if (Object.keys(known).length) {
        setErrors(known);
        (form.elements.namedItem(Object.keys(known)[0]) as HTMLElement | null)?.focus();
      } else {
        setGeneral(accountErrorMessage(err));
      }
      setPending(false);
    }
  }

  const loginHref = `/connexion${next !== "/compte" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="register-form">
      <Field id="fullName" label="Nom complet" required error={errors.fullName}>
        <Input id="fullName" name="fullName" autoComplete="name" aria-invalid={Boolean(errors.fullName)} aria-describedby="fullName-msg" />
      </Field>
      <Field id="email" label="E-mail" required error={errors.email} hint="Pour suivre vos commandes et vous connecter">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          // Uncontrolled on purpose: text typed before hydration must not be wiped out when React takes over.
          defaultValue={presetEmail}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby="email-msg"
        />
      </Field>
      <Field id="phone" label="Téléphone" error={errors.phone} hint="Facultatif · ex. +509 3712-3456">
        <Input id="phone" name="phone" type="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} aria-describedby="phone-msg" />
      </Field>
      <div className="space-y-3">
        <PasswordField id="password" name="password" label="Mot de passe" autoComplete="new-password" required error={errors.password} onChange={setPassword} />
        <PasswordStrength score={hints.score} items={hints.items} />
      </div>
      <div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="acceptTerms"
            id="acceptTerms"
            className="mt-0.5 size-5 shrink-0 rounded border-ip-line accent-[var(--color-ip-teal)]"
            aria-invalid={Boolean(errors.acceptTerms)}
            aria-describedby="acceptTerms-msg"
          />
          <span>
            J&apos;accepte les{" "}
            <Link href="/conditions" target="_blank" className="font-semibold text-ip-teal underline-offset-2 hover:underline">
              conditions d&apos;utilisation et la politique de confidentialité
            </Link>
            .
          </span>
        </label>
        <p id="acceptTerms-msg" role={errors.acceptTerms ? "alert" : undefined} className="mt-1 min-h-4 text-xs text-red-700">
          {errors.acceptTerms ?? ""}
        </p>
      </div>
      {general && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800" data-testid="register-error">
          {general}{" "}
          {/existe déjà/i.test(general) && (
            <Link href={loginHref} className="font-semibold underline">
              Se connecter
            </Link>
          )}
        </p>
      )}
      <Button type="submit" variant="sun" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
        {pending ? "Création du compte…" : "Créer mon compte"}
      </Button>
      <p className="text-center text-sm text-ip-muted">
        Déjà un compte ?{" "}
        <Link href={loginHref} className="font-semibold text-ip-teal underline-offset-2 hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
