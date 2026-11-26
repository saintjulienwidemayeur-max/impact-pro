import type { Metadata } from "next";
import { AccountDashboard } from "@/components/account/account-dashboard";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Mon espace client", robots: { index: false, follow: false } };

export default function AccountPage() {
  return (
    <>
      <PageHeader title="Mon espace client" intro="Vos commandes, vos informations et votre sécurité." crumbs={[{ label: "Espace client" }]} />
      <AccountDashboard />
    </>
  );
}
