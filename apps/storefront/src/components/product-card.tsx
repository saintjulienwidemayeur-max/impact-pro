import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { discountPercent, formatHTG } from "@/lib/utils";
import { AddToCartIconButton } from "./add-to-cart";
import { ProductVisual } from "./product-visual";

export function ProductCard({ product }: { product: Product }) {
  const pct = discountPercent(product.priceHTG, product.oldPriceHTG);
  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-ip-line bg-white transition-shadow hover:shadow-lg">
      <Link href={`/produits/${product.slug}`} className="relative block aspect-[5/4] bg-ip-mist p-3" tabIndex={-1} aria-hidden="true">
        <ProductVisual product={product} className="transition-transform duration-300 group-hover:scale-105" />
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        <h3 className="text-sm font-semibold leading-tight sm:text-base">
          <Link href={`/produits/${product.slug}`} className="hover:text-ip-teal">
            {product.name}
          </Link>
        </h3>
        <p className="text-xs text-ip-muted">{product.shortDescription}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-base font-bold text-ip-ink sm:text-lg">{formatHTG(product.priceHTG)}</span>
          {product.oldPriceHTG && (
            <span className="text-xs text-ip-muted line-through">
              <span className="sr-only">Prix habituel : </span>
              {formatHTG(product.oldPriceHTG)}
            </span>
          )}
          {pct && <span className="rounded-md bg-ip-sun px-1.5 py-0.5 text-[11px] font-bold text-ip-ink">-{pct} %</span>}
        </div>
        <p className="text-[11px] text-ip-muted">par {product.unit} · min. {product.minQuantity}</p>
        <div className="mt-auto flex gap-2 pt-3">
          <Link
            href={`/produits/${product.slug}`}
            className="inline-flex h-10 min-w-0 flex-1 items-center justify-center rounded-xl border-2 border-ip-sun px-1 text-[11px] sm:text-xs font-bold uppercase tracking-wide text-ip-ink transition-colors hover:bg-ip-sun"
          >
            Commander
          </Link>
          <AddToCartIconButton product={product} />
        </div>
      </div>
    </article>
  );
}
