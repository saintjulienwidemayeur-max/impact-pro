import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/account/register-form";
import { AuthShell } from "@/components/account/shared";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Créer un compte", robots: { index: false, follow: false } };

export default function RegisterPage() {
  return (
    <>
      <PageHeader title="Créer un compte" intro="Suivez vos commandes et recommandez en quelques clics." crumbs={[{ label: "Créer un compte" }]} />
      <AuthShell title="Créer mon compte" subtitle="C'est gratuit. Vous pouvez aussi commander sans compte.">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-ip-mist" aria-busy="true" />}>
          <RegisterForm />
        </Suspense>
      </AuthShell>
    </>
  );
}
