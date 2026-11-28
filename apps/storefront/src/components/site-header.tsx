"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { ArrowRight, ChevronDown, Menu, Paintbrush, Search, ShoppingBag, User, X } from "lucide-react";
import { initialOf, useAuth } from "./auth-provider";
import { useCart } from "./cart-provider";
import { promoCategories, quoteHref } from "@/config/offer";
import { categoryIcons } from "@/config/offer-icons";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href: string; mega?: true };
const nav: NavItem[] = [
  { label: "Articles promotionnels", href: "/articles-promotionnels", mega: true },
  { label: "Sourcing & achats", href: "/sourcing" },
  { label: "Événements & conseil", href: "/evenements-conseil" },
  { label: "Boutique en ligne", href: "/produits" },
  { label: "À propos", href: "/a-propos" },
  { label: "Contact", href: "/contact" },
];

function TopBar() {
  return (
    <div className="bg-ip-ink text-[12.5px] text-white/75">
      <div className="container-ip flex h-9 items-center justify-center gap-4 sm:justify-between">
        <p className="flex items-center gap-2">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-400" />
          <span>
            Basés à <strong className="font-semibold text-white">Miami</strong> · au service de vos projets en{" "}
            <strong className="font-semibold text-white">Haïti</strong>
          </span>
        </p>
        <p className="hidden sm:block">Guichet unique · Proforma sous 24 h ouvrées</p>
      </div>
    </div>
  );
}

/** Signed out → /connexion; signed in → /compte with the customer's initial. */
function AccountLink() {
  const { user, status } = useAuth();
  const base = "inline-flex size-10 items-center justify-center rounded-xl border border-ip-line hover:border-ip-teal hover:text-ip-teal";
  if (user) {
    return (
      <Link href="/compte" aria-label={`Mon compte, connecté en tant que ${user.fullName ?? user.email}`} data-testid="account-link" className={base}>
        <span aria-hidden="true" className="inline-flex size-7 items-center justify-center rounded-full bg-ip-teal font-heading text-sm font-bold text-white">
          {initialOf(user)}
        </span>
      </Link>
    );
  }
  return (
    <Link href="/connexion" aria-label="Se connecter" data-testid="account-link" data-auth={status} className={base}>
      <User className="size-5" aria-hidden="true" />
    </Link>
  );
}

function MegaMenu({ onClose }: { onClose: () => void }) {
  return (
    <div id="mega-articles" className="absolute inset-x-0 top-full z-50 border-t border-ip-line bg-white shadow-[0_40px_80px_-30px_rgba(14,42,46,0.45)]">
      <div className="container-ip grid gap-8 py-8 lg:grid-cols-[1fr_1fr_1fr_320px]">
        {promoCategories.map((c) => {
          const Icon = categoryIcons[c.slug];
          return (
            <div key={c.slug}>
              <Link href={`/articles-promotionnels/${c.slug}`} onClick={onClose} className="group flex items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-ip-mist text-ip-teal">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="whitespace-nowrap font-heading text-lg font-semibold group-hover:text-ip-teal">{c.name}</span>
              </Link>
              <p className="ml-[52px] mt-1 text-[13.5px] leading-snug text-ip-muted">{c.short}</p>
              <ul className="ml-[52px] mt-3 space-y-0.5">
                {c.groups.map((g) => (
                  <li key={g}>
                    <Link
                      href={`/articles-promotionnels/${c.slug}`}
                      onClick={onClose}
                      className="-ml-2.5 flex h-9 items-center rounded-lg px-2.5 text-[14.5px] font-medium hover:bg-ip-mist hover:text-ip-teal"
                    >
                      {g}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={`/articles-promotionnels/${c.slug}`} onClick={onClose} className="ml-[52px] mt-3 inline-flex items-center gap-1 text-sm font-bold text-ip-teal hover:underline">
                Voir la catégorie <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          );
        })}
        <div className="overflow-hidden rounded-2xl bg-ip-deep text-white">
          <div className="relative h-40 bg-ip-mist">
            <Image src="/photos/showcase/t-shirt-personnalise.webp" alt="" fill sizes="320px" className="object-cover" />
            <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold tracking-wide text-emerald-700">● STUDIO EN LIGNE</span>
          </div>
          <div className="p-5">
            <p className="font-heading text-xl font-semibold">Personnalisez en ligne</p>
            <p className="mt-1 text-[13.5px] text-white/75">Ajoutez votre logo ou votre photo et voyez le rendu avant d&apos;envoyer votre demande.</p>
            <Link href="/personnaliser" onClick={onClose} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-ip-sun px-4 text-sm font-bold text-ip-ink hover:bg-ip-sun-600">
              Ouvrir le studio <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ip-line pt-5 text-sm text-ip-muted lg:col-span-4">
          <p>
            Vous ne trouvez pas votre article ? <strong className="text-ip-ink">Notre service de sourcing le trouve pour vous.</strong>
          </p>
          <Link href="/sourcing" onClick={onClose} className="inline-flex items-center gap-1 font-bold text-ip-teal hover:underline">
            Lancer une recherche de produit <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { count, ready } = useCart();
  const { user } = useAuth();
  const [megaOpen, setMegaOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const headerRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    setMegaOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setMegaOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMegaOpen(false);
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
  const itemClass = (active: boolean) =>
    cn("inline-flex h-10 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 text-[14px] font-semibold hover:bg-ip-mist hover:text-ip-teal", active && "bg-ip-mist text-ip-teal");

  return (
    <>
      <TopBar />
      <header ref={headerRef} className="sticky top-0 z-40 border-b border-ip-line bg-white/95 backdrop-blur">
        <div className="container-ip flex h-[76px] items-center gap-4">
          <Link href="/" className="shrink-0" aria-label="Impact Pro — accueil">
            <Image src="/brand/logo-impact-pro.png" alt="Impact Pro" width={1600} height={498} priority className="h-10 w-auto" />
          </Link>

          <nav aria-label="Navigation principale" className="ml-3 hidden min-w-0 flex-1 items-center gap-0.5 xl:flex">
            {nav.map((item) =>
              item.mega ? (
                <button
                  key={item.label}
                  type="button"
                  aria-expanded={megaOpen}
                  aria-controls="mega-articles"
                  onClick={() => setMegaOpen((o) => !o)}
                  className={itemClass(megaOpen || isActive(item.href))}
                >
                  {item.label}
                  <ChevronDown className={cn("size-4 opacity-60 transition-transform", megaOpen && "rotate-180")} aria-hidden="true" />
                </button>
              ) : (
                <Link key={item.label} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={itemClass(isActive(item.href))}>
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/produits"
              aria-label="Rechercher un produit"
              className="hidden size-10 items-center justify-center rounded-xl border border-ip-line hover:border-ip-teal hover:text-ip-teal sm:inline-flex"
            >
              <Search className="size-5" aria-hidden="true" />
            </Link>
            <AccountLink />
            <Link
              href="/panier"
              aria-label={`Panier, ${count} article${count > 1 ? "s" : ""}`}
              className="relative inline-flex size-10 items-center justify-center rounded-xl border border-ip-line hover:border-ip-teal hover:text-ip-teal"
            >
              <ShoppingBag className="size-5" aria-hidden="true" />
              <span
                data-testid="cart-count"
                className={cn(
                  "absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-ip-sun px-1 text-[11px] font-bold leading-5 text-ip-ink",
                  !ready && "opacity-0",
                )}
              >
                {count > 999 ? "999+" : count}
              </span>
            </Link>
            <Link href={quoteHref()} className="ml-1.5 hidden h-11 items-center rounded-xl bg-ip-teal px-4 text-sm font-bold text-white hover:bg-ip-teal-600 2xl:inline-flex">
              Demander une proforma
            </Link>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-xl bg-ip-ink text-white xl:hidden"
              aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {megaOpen && <MegaMenu onClose={() => setMegaOpen(false)} />}

        {mobileOpen && (
          <div id="mobile-menu" className="max-h-[calc(100dvh-76px)] overflow-y-auto border-t border-ip-line bg-white xl:hidden">
            <div className="container-ip flex flex-col gap-4 py-4">
              <nav aria-label="Navigation mobile">
                <ul className="flex flex-col">
                  <li>
                    <details className="group" open>
                      <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-3 font-semibold hover:bg-ip-mist">
                        Articles promotionnels
                        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                      </summary>
                      <ul className="mb-2 ml-3 border-l-2 border-ip-cyan pl-3">
                        <li>
                          <Link href="/articles-promotionnels" className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-ip-mist">
                            Toutes les catégories
                          </Link>
                        </li>
                        {promoCategories.map((c) => (
                          <li key={c.slug}>
                            <Link href={`/articles-promotionnels/${c.slug}`} className="block rounded-lg px-3 py-2 text-sm hover:bg-ip-mist">
                              {c.name}
                            </Link>
                          </li>
                        ))}
                        <li>
                          <Link href="/personnaliser" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-ip-mist">
                            <Paintbrush className="size-4 text-ip-teal" aria-hidden="true" /> Studio en ligne
                          </Link>
                        </li>
                      </ul>
                    </details>
                  </li>
                  {nav
                    .filter((i) => !i.mega)
                    .map((item) => (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          aria-current={isActive(item.href) ? "page" : undefined}
                          className={cn("block rounded-xl px-3 py-3 font-semibold hover:bg-ip-mist", isActive(item.href) && "text-ip-teal")}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                </ul>
              </nav>
              <div className="grid grid-cols-2 gap-2">
                {user ? (
                  <Link href="/compte" className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-ip-teal font-semibold text-ip-teal">
                    <User className="size-4" aria-hidden="true" /> Mon espace client
                  </Link>
                ) : (
                  <>
                    <Link href="/connexion" className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-ip-teal font-semibold text-ip-teal">
                      Se connecter
                    </Link>
                    <Link href="/inscription" className="inline-flex h-11 items-center justify-center rounded-xl bg-ip-teal font-semibold text-white">
                      Créer un compte
                    </Link>
                  </>
                )}
              </div>
              <Link href={quoteHref()} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ip-sun font-bold text-ip-ink">
                Demander une proforma <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
