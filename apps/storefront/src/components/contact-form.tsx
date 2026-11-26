"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Field, Input, Textarea } from "./ui/field";
import { contactSchema, fieldErrors } from "@/lib/schemas";

export function ContactForm() {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const parsed = contactSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string; fields?: Record<string, string> } } | null;
        if (body?.error?.fields) setErrors(body.error.fields);
        throw new Error(body?.error?.message ?? "Envoi impossible pour le moment.");
      }
      toast.success("Message envoyé ! Nous vous répondons rapidement.");
      form.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  const a = (id: string) => ({ "aria-describedby": `c-${id}-msg`, "aria-invalid": Boolean(errors[id]) });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-label="Formulaire de contact">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="c-name" label="Nom" required error={errors.name}>
          <Input id="c-name" name="name" autoComplete="name" {...a("name")} />
        </Field>
        <Field id="c-email" label="Courriel" required error={errors.email}>
          <Input id="c-email" name="email" type="email" autoComplete="email" {...a("email")} />
        </Field>
      </div>
      <Field id="c-subject" label="Sujet" required error={errors.subject}>
        <Input id="c-subject" name="subject" {...a("subject")} />
      </Field>
      <Field id="c-message" label="Message" required error={errors.message}>
        <Textarea id="c-message" name="message" rows={5} {...a("message")} />
      </Field>
      <div>
        <Button type="submit" variant="teal" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Envoyer
        </Button>
      </div>
    </form>
  );
}
