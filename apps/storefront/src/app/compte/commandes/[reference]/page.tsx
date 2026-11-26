import type { Metadata } from "next";
import { OrderDetailView } from "@/components/account/order-detail-view";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Détail de la commande", robots: { index: false, follow: false } };

type Params = Promise<{ reference: string }>;

export default async function MyOrderPage({ params }: { params: Params }) {
  const { reference } = await params;
  const ref = decodeURIComponent(reference).slice(0, 40);
  return (
    <>
      <PageHeader title="Détail de la commande" crumbs={[{ label: "Espace client", href: "/compte" }, { label: ref }]} />
      <OrderDetailView reference={ref} />
    </>
  );
}
