"use client";

import {
  BarChart3,
  Boxes,
  FileText,
  Files,
  History,
  LayoutDashboard,
  type LucideIcon,
  LogOut,
  Mail,
  Menu,
  Receipt,
  Settings,
  ShoppingBag,
  Users,
  UserCog,
  X,
  KeyRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Skeleton } from "@/components/ui/kit";
import { useRequireStaff } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";
import { roleLabel } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perm: Permission;
}
export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Activité",
    items: [
      { href: "/", label: "Tableau de bord", icon: LayoutDashboard, perm: "dashboard.read" },
      { href: "/commandes", label: "Commandes", icon: ShoppingBag, perm: "orders.read" },
      { href: "/clients", label: "Clients", icon: Users, perm: "customers.read" },
    ],
  },
  {
    title: "Facturation",
    items: [
      { href: "/devis", label: "Devis", icon: FileText, perm: "quotes.read" },
      { href: "/proformas", label: "Proformas", icon: Files, perm: "quotes.read" },
      { href: "/factures", label: "Factures", icon: Receipt, perm: "invoices.read" },
      { href: "/rapports", label: "Rapports", icon: BarChart3, perm: "reports.read" },
    ],
  },
  { title: "Catalogue", items: [{ href: "/produits", label: "Produits & prix", icon: Boxes, perm: "products.read" }] },
  { title: "Communication", items: [{ href: "/messagerie", label: "Messagerie", icon: Mail, perm: "mail.read" }] },
  {
    title: "Administration",
    items: [
      { href: "/utilisateurs", label: "Utilisateurs & rôles", icon: UserCog, perm: "users.manage" },
      { href: "/audit", label: "Journal d'audit", icon: History, perm: "audit.read" },
      { href: "/parametres", label: "Paramètres", icon: Settings, perm: "billing.settings" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/devis") return pathname.startsWith("/devis");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const auth = useRequireStaff();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [menu, setMenu] = React.useState(false);

  React.useEffect(() => setOpen(false), [pathname]);

  if (auth.status !== "staff" || auth.user?.mustChangePassword) {
    return (
      <div className="grid min-h-dvh place-items-center p-6" role="status" aria-label="Chargement">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }
  const user = auth.user!;
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => auth.can(i.perm)) })).filter((g) => g.items.length > 0);

  const nav = (
    <nav aria-label="Navigation principale" className="flex-1 space-y-5 overflow-y-auto px-3 py-4" data-testid="sidebar-nav">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const active = isActive(pathname, i.href);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={active ? "page" : undefined}
                    className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors", active ? "bg-white text-ip-teal" : "text-white/85 hover:bg-white/10")}
                  >
                    <i.icon className="size-4.5 shrink-0" aria-hidden="true" /> {i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-ip-teal lg:flex">
        <div className="px-5 pt-5">
          <Image src="/brand/logo-impact-pro-inverse.png" alt="Impact Pro" width={160} height={52} className="h-11 w-auto" />
          <p className="mt-1 text-xs text-white/60">Administration</p>
        </div>
        {nav}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-ip-teal shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-5">
              <Image src="/brand/logo-impact-pro-inverse.png" alt="Impact Pro" width={160} height={52} className="h-10 w-auto" />
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-lg p-1.5 text-white hover:bg-white/10">
                <X className="size-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-ip-line bg-white/95 px-3 backdrop-blur sm:px-5">
          <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" className="rounded-lg p-2 hover:bg-ip-mist lg:hidden" data-testid="open-menu">
            <Menu className="size-5" />
          </button>
          <div className="hidden text-sm text-ip-muted lg:block">Impact Pro LLC · Miami</div>
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setMenu((m) => !m)}
              aria-haspopup="menu"
              aria-expanded={menu}
              data-testid="user-menu"
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-ip-mist"
            >
              <span className="grid size-8 place-items-center rounded-full bg-ip-teal font-heading text-sm font-bold text-white" aria-hidden="true">
                {(user.fullName ?? user.email)[0]?.toUpperCase()}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-semibold">{user.fullName ?? user.email}</span>
                <span className="block text-xs text-ip-muted" data-testid="user-role">
                  {roleLabel(user.staffRole)}
                </span>
              </span>
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 mt-2 w-60 rounded-2xl border border-ip-line bg-white p-1.5 shadow-xl">
                <p className="px-3 py-2 text-xs text-ip-muted">{user.email}</p>
                <button role="menuitem" type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-ip-mist" onClick={() => router.push("/changer-mot-de-passe")}>
                  <KeyRound className="size-4" aria-hidden="true" /> Changer mon mot de passe
                </button>
                <button
                  role="menuitem"
                  type="button"
                  data-testid="logout"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-ip-mist"
                  onClick={() => void auth.logout().then(() => router.replace("/login"))}
                >
                  <LogOut className="size-4" aria-hidden="true" /> Se déconnecter
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="p-3 sm:p-6" id="contenu">
          {children}
        </main>
      </div>
    </div>
  );
}
