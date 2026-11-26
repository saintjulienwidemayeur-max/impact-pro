import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Panier", robots: { index: false } };

export default function CartPage() {
  return (
    <>
      <PageHeader title="Mon panier" crumbs={[{ label: "Panier" }]} />
      <div className="container-ip py-10">
        <CartView />
      </div>
    </>
  );
}
