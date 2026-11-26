import Image from "next/image";
import Link from "next/link";
import { ImageOff, Paintbrush } from "lucide-react";
import { primaryPhoto } from "@/config/product-media";
import type { Product } from "@/lib/api";
import { lowestPrice, toNumber } from "@/lib/pricing";
import { discountPercent, formatHTG } from "@/lib/utils";

export function ProductCard({ product, priority }: { product: Product; priority?: boolean }) {
  const photo = primaryPhoto(product);
  const price = toNumber(product.basePrice);
  const compare = product.compareAtPrice ? toNumber(product.compareAtPrice) : undefined;
  const pct = discountPercent(price, compare);
  const from = lowestPrice(product.basePrice, product.priceTiers);

  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-ip-line bg-white transition-shadow hover:shadow-lg">
      <Link href={`/produits/${product.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-white" tabIndex={-1} aria-hidden="true">
        {photo ? (
          <Image
            src={photo.src}
            alt=""
            fill
            sizes="(min-width: 1280px) 16vw, (min-width: 768px) 30vw, 50vw"
            priority={priority}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full items-center justify-center bg-ip-mist text-ip-muted">
            <ImageOff className="size-8" aria-hidden="true" />
          </span>
        )}
        {pct && <span className="absolute left-2 top-2 rounded-md bg-ip-sun px-1.5 py-0.5 text-[11px] font-bold text-ip-ink">-{pct} %</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ip-teal">{product.category.name}</p>
        <h3 className="text-sm font-semibold leading-tight sm:text-base">
          <Link href={`/produits/${product.slug}`} className="hover:text-ip-teal">
            {product.name}
          </Link>
        </h3>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-base font-bold text-ip-ink sm:text-lg">{formatHTG(price)}</span>
          {compare && compare > price && (
            <span className="text-xs text-ip-muted line-through">
              <span className="sr-only">Prix habituel : </span>
              {formatHTG(compare)}
            </span>
          )}
        </div>
        <p className="text-[11px] text-ip-muted">
          par {product.unitLabel} · min. {product.minQty}
          {from < price && <> · dès {formatHTG(from)} en volume</>}
        </p>
        <div className="mt-auto pt-3">
          <Link
            href={`/personnaliser/${product.slug}`}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-ip-sun px-2 text-[11px] font-bold uppercase tracking-wide text-ip-ink transition-colors hover:bg-ip-sun-600 sm:text-xs"
          >
            <Paintbrush className="size-3.5 shrink-0" aria-hidden="true" /> Personnaliser
          </Link>
        </div>
      </div>
    </article>
  );
}
