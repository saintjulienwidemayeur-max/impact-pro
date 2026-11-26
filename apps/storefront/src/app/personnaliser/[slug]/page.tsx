import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiUnavailable } from "@/components/api-unavailable";
import { Customizer } from "@/components/customizer";
import { PageHeader } from "@/components/page-header";
import { getProduct, type Product } from "@/lib/api";

export const revalidate = 60;

type Params = Promise<{ slug: string }>;

async function load(slug: string): Promise<{ product: Product | null; failed: boolean }> {
  try {
    return { product: await getProduct(slug), failed: false };
  } catch {
    return { product: null, failed: true };
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { product } = await load((await params).slug);
  return {
    title: product ? `Personnaliser : ${product.name}` : "Personnaliser",
    description: product
      ? `Ajoutez votre logo sur ${product.name}, visualisez l'aperçu et commandez en ligne.`
      : "Ajoutez votre logo sur nos articles promotionnels.",
    alternates: { canonical: `/personnaliser/${(await params).slug}` },
  };
}

export default async function CustomizeProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const { product, failed } = await load(slug);
  if (!failed && !product) notFound();

  return (
    <>
      <PageHeader
        title={product ? `Personnaliser : ${product.name}` : "Personnaliser"}
        intro="Téléversez votre logo, ajustez l'aperçu, choisissez vos options et la quantité."
        crumbs={[{ label: "Personnaliser", href: "/personnaliser" }, ...(product ? [{ label: product.name }] : [])]}
      />
      <div className="container-ip py-10">{product ? <Customizer product={product} /> : <ApiUnavailable title="Produit momentanément indisponible" />}</div>
    </>
  );
}
