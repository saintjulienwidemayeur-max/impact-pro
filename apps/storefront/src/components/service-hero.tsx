import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Dark hero for service / category pages (same language as the homepage hero). */
export function ServiceHero({
  eyebrow,
  title,
  intro,
  crumbs,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  crumbs: { label: string; href?: string }[];
  children?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  const all = [{ label: "Accueil", href: "/" }, ...crumbs];
  return (
    <section className="relative overflow-hidden bg-ip-deep text-white">
      <div aria-hidden="true" className="pointer-events-none absolute -right-52 -top-64 size-[800px] rounded-full bg-[radial-gradient(closest-side,rgba(10,113,106,0.7),rgba(10,61,57,0))]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-72 -top-[380px] size-[760px] rounded-full border border-white/[0.07]" />
      <div className={`container-ip relative grid items-center gap-10 py-12 sm:py-16 ${aside ? "lg:grid-cols-[minmax(0,600px)_1fr]" : ""}`}>
        <div>
          <nav aria-label="Fil d'Ariane">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-white/65">
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
          <p className="mt-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-ip-cyan">
            <span aria-hidden="true" className="h-0.5 w-[18px] rounded bg-current" />
            {eyebrow}
          </p>
          <h1 className="mt-3 text-[38px] font-semibold leading-[1.06] tracking-[-0.015em] sm:text-[52px]">{title}</h1>
          <p className="mt-4 max-w-[580px] text-[17px] leading-relaxed text-white/80">{intro}</p>
          {children && <div className="mt-8 flex flex-col gap-3 sm:flex-row">{children}</div>}
        </div>
        {aside}
      </div>
      <div className="brand-stripe h-1.5" />
    </section>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-[50px] items-center justify-center gap-2.5 rounded-xl bg-ip-sun px-6 font-bold text-ip-ink hover:bg-ip-sun-600">
      {children}
    </Link>
  );
}

export function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-[50px] items-center justify-center gap-2.5 rounded-xl border-[1.5px] border-white/35 px-6 font-bold hover:bg-white/10">
      {children}
    </Link>
  );
}
