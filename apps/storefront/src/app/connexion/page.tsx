import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/account/login-form";
import { AuthShell } from "@/components/account/shared";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Connexion", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <>
      <PageHeader title="Connexion" intro="Retrouvez vos commandes et vos informations." crumbs={[{ label: "Connexion" }]} />
      <AuthShell title="Se connecter" subtitle="Entrez l'e-mail et le mot de passe de votre compte Impact Pro.">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-ip-mist" aria-busy="true" />}>
          <LoginForm />
        </Suspense>
      </AuthShell>
    </>
  );
}
