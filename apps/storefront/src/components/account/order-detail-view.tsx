"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ArrowLeft, CloudOff, SearchX } from "lucide-react";
import { useAuth } from "../auth-provider";
import { OrderDetails } from "../order-details";
import { getMyOrder } from "@/lib/account-api";
import { optionLabelsBySlug, type CustomOrder } from "@/lib/api";

type State = { kind: "loading" } | { kind: "ready"; order: CustomOrder; labels: Record<string, { colorLabel?: string; sizeLabel?: string }> } | { kind: "missing" } | { kind: "error" };

/** One of the signed-in customer's orders (the API answers 404 for anything that is not theirs). */
export function OrderDetailView({ reference }: { reference: string }) {
  const router = useRouter();
  const { status } = useAuth();
  const [state, setState] = React.useState<State>({ kind: "loading" });

  React.useEffect(() => {
    if (status === "guest") router.replace(`/connexion?next=${encodeURIComponent(`/compte/commandes/${reference}`)}`);
  }, [status, router, reference]);

  React.useEffect(() => {
    if (status !== "authenticated") return;
    let alive = true;
    (async () => {
      try {
        const order = await getMyOrder(reference);
        if (!alive) return;
        if (!order) return setState({ kind: "missing" });
        const labels = await optionLabelsBySlug();
        if (alive) setState({ kind: "ready", order, labels });
      } catch {
        if (alive) setState({ kind: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [status, reference]);

  return (
    <div className="container-ip space-y-6 py-8 sm:py-10">
      <Link href="/compte" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ip-teal underline-offset-2 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Retour à mes commandes
      </Link>
      {state.kind === "loading" && (
        <div className="space-y-4" aria-busy="true" aria-label="Chargement de la commande">
          <div className="h-16 animate-pulse rounded-2xl bg-ip-mist" />
          <div className="h-72 animate-pulse rounded-2xl bg-ip-mist" />
        </div>
      )}
      {state.kind === "ready" && <OrderDetails order={state.order} labels={state.labels} />}
      {state.kind === "missing" && (
        <div role="alert" className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-ip-line bg-ip-mist px-6 py-14 text-center" data-testid="order-missing">
          <SearchX className="size-10 text-ip-teal" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-semibold">Commande introuvable</h2>
          <p className="mt-1 max-w-md text-sm text-ip-muted">Cette commande n&apos;existe pas ou n&apos;est pas liée à votre compte.</p>
        </div>
      )}
      {state.kind === "error" && (
        <div role="alert" className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-ip-line bg-ip-mist px-6 py-14 text-center">
          <CloudOff className="size-10 text-ip-teal" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-semibold">Commande momentanément indisponible</h2>
          <p className="mt-1 text-sm text-ip-muted">Réessayez dans un instant.</p>
        </div>
      )}
    </div>
  );
}
