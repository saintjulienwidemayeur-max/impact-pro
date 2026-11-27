"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { useAuth } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";

/** Page-level permission gate (the server stays the authority; this avoids showing a broken page). */
export function Gate({ perm, children }: { perm: Permission | Permission[]; children: React.ReactNode }) {
  const { can } = useAuth();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (!perms.some((p) => can(p))) {
    return (
      <div role="alert" data-testid="forbidden" className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-ip-line bg-white p-8 text-center">
        <ShieldAlert className="size-10 text-ip-muted" aria-hidden="true" />
        <h1 className="font-heading text-xl font-bold">Accès refusé</h1>
        <p className="text-sm text-ip-muted">Votre rôle ne vous donne pas accès à cette page. Contactez un administrateur si vous en avez besoin.</p>
        <Link href="/" className="text-sm font-semibold text-ip-teal underline">
          Retour au tableau de bord
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
