"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { ArrowRight, ChevronDown, Menu, Search, ShoppingCart, User, X } from "lucide-react";
import { useCart } from "./cart-provider";
import { navCategories as categories } from "@/config/navigation";
import { mainNav, services, site } from "@/lib/site";
import { cn } from "@/lib/utils";

type MenuId = "services" | "products";

const menus: Record<MenuId, { label: string; href: string }[]> = {
  services: [
    ...services.map((s) => ({ label: s.name, href: `/personnaliser#${s.id}` })),
    { label: "Tous les services", href: "/personnaliser" },
  ],
  products: [...categories.map((c) => ({ label: c.name, href: `/produits?categorie=${c.slug}` })), { label: "Tous les produits", href: "/produits" }],
};

function TopBar() {
  return (
    <div className="bg-ip-deep text-white">
      <div className="container-ip flex h-11 items-center justify-center gap-3 text-sm sm:justify-between">
        <p className="hidden font-heading text-base font-medium sm:block">{site.tagline}</p>
        <p className="hidden text-white/80 md:block">Articles promotionnels personnalisés en Haïti · Livraison partout</p>
        <Link
          href="/devis"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ip-sun px-3 text-xs font-bold uppercase tracking-wide text-ip-ink hover:bg-ip-sun-600"
        >
          Demander un devis <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function SearchForm({ className, id }: { className?: string; id: string }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        router.push(term ? `/produits?q=${encodeURIComponent(term)}` : "/produits");
      }}
    >
      <label htmlFor={id} className="sr-only">
        Rechercher un produit
      </label>
      <input
        id={id}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher un produit…"
        className="h-10 w-full rounded-xl border border-ip-line bg-ip-mist pl-4 pr-11 text-sm focus:border-ip-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-ip-cyan/50"
      />
      <button
        type="submit"
        aria-label="Lancer la recherche"
        className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-lg text-ip-teal hover:bg-ip-teal hover:text-white"
      >
        <Search className="size-4" aria-hidden="true" />
      </button>
    </form>
  );
}

function DesktopDropdown({ id, label, open, onToggle, onClose }: { id: MenuId; label: string; open: boolean; onToggle: () => void; onClose: () => void }) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`menu-${id}`}
        onClick={onToggle}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold uppercase tracking-wide hover:text-ip-teal",
          open && "text-ip-teal",
        )}
      >
        {label}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <ul
          id={`menu-${id}`}
          className="absolute left-0 top-full z-50 mt-2 w-64 rounded-2xl border border-ip-line bg-white p-2 shadow-xl"
        >
          {menus[id].map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={onClose} className="block rounded-xl px-3 py-2 text-sm hover:bg-ip-mist hover:text-ip-teal">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { count, ready } = useCart();
  const [openMenu, setOpenMenu] = React.useState<MenuId | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const navRef = React.useRef<HTMLElement>(null);

  // Close menus on route change
  React.useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  // Close dropdown on outside click / Escape
  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  React.useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <TopBar />
      <header className="sticky top-0 z-40 border-b border-ip-line bg-white/95 backdrop-blur">
        <div className="container-ip flex h-[72px] items-center gap-4">
          <Link href="/" className="shrink-0" aria-label="Impact Pro — accueil">
            <Image src="/brand/logo-impact-pro.png" alt="Impact Pro" width={1600} height={498} priority className="h-10 w-auto sm:h-11" />
          </Link>

          <nav ref={navRef} aria-label="Navigation principale" className="ml-4 hidden flex-1 items-center gap-0.5 xl:flex">
            {mainNav.map((item) =>
              item.menu ? (
                <DesktopDropdown
                  key={item.label}
                  id={item.menu}
                  label={item.label}
                  open={openMenu === item.menu}
                  onToggle={() => setOpenMenu((m) => (m === item.menu ? null : item.menu!))}
                  onClose={() => setOpenMenu(null)}
                />
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold uppercase tracking-wide hover:text-ip-teal",
                    isActive(item.href) && "text-ip-teal after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:rounded after:bg-ip-sun",
                  )}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <SearchForm id="search-desktop" className="hidden w-56 lg:block" />
            <Link href="/compte" aria-label="Mon compte" className="inline-flex size-10 items-center justify-center rounded-xl hover:bg-ip-mist hover:text-ip-teal">
              <User className="size-5" aria-hidden="true" />
            </Link>
            <Link
              href="/panier"
              aria-label={`Panier, ${count} article${count > 1 ? "s" : ""}`}
              className="relative inline-flex size-10 items-center justify-center rounded-xl hover:bg-ip-mist hover:text-ip-teal"
            >
              <ShoppingCart className="size-5" aria-hidden="true" />
              <span
                data-testid="cart-count"
                className={cn(
                  "absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-ip-sun px-1 text-[11px] font-bold leading-5 text-ip-ink",
                  !ready && "opacity-0",
                )}
              >
                {count > 999 ? "999+" : count}
              </span>
            </Link>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-xl hover:bg-ip-mist xl:hidden"
              aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div id="mobile-menu" className="max-h-[calc(100dvh-72px)] overflow-y-auto border-t border-ip-line bg-white xl:hidden">
            <div className="container-ip flex flex-col gap-4 py-4">
              <SearchForm id="search-mobile" />
              <nav aria-label="Navigation mobile">
                <ul className="flex flex-col">
                  {mainNav.map((item) =>
                    item.menu ? (
                      <li key={item.label}>
                        <details className="group">
                          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-3 font-semibold hover:bg-ip-mist">
                            {item.label}
                            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                          </summary>
                          <ul className="mb-2 ml-3 border-l-2 border-ip-cyan pl-3">
                            {menus[item.menu].map((sub) => (
                              <li key={sub.href}>
                                <Link href={sub.href} onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-ip-mist">
                                  {sub.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </li>
                    ) : (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          aria-current={isActive(item.href) ? "page" : undefined}
                          className={cn("block rounded-xl px-3 py-3 font-semibold hover:bg-ip-mist", isActive(item.href) && "text-ip-teal")}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </nav>
              <Link href="/devis" onClick={() => setMobileOpen(false)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ip-sun font-bold text-ip-ink">
                Demander un devis <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
