import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function PageHeader({
  title,
  intro,
  crumbs = [],
}: {
  title: string;
  intro?: string;
  crumbs?: { label: string; href?: string }[];
}) {
  const all = [{ label: "Accueil", href: "/" }, ...crumbs];
  return (
    <section className="relative overflow-hidden bg-ip-teal text-white">
      <svg className="pointer-events-none absolute -right-24 -top-32 h-[360px] w-[360px]" viewBox="0 0 600 600" aria-hidden="true">
        <circle cx="300" cy="300" r="250" fill="none" stroke="white" strokeOpacity="0.07" strokeWidth="80" />
      </svg>
      <div className="container-ip relative py-10 sm:py-12">
        <nav aria-label="Fil d'Ariane">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-white/75">
            {all.map((c, i) => (
              <li key={c.label} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3" aria-hidden="true" />}
                {c.href && i < all.length - 1 ? (
                  <Link href={c.href} className="hover:text-white hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-white">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{title}</h1>
        {intro && <p className="mt-2 max-w-2xl text-white/85">{intro}</p>}
      </div>
      <div className="brand-stripe h-1.5" />
    </section>
  );
}
