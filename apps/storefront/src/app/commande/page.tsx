import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Commande", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <>
      <PageHeader title="Finaliser la commande" crumbs={[{ label: "Panier", href: "/panier" }, { label: "Commande" }]} />
      <div className="container-ip py-10">
        <CheckoutForm />
      </div>
    </>
  );
}
