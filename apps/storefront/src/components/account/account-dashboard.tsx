"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { ArrowRight, ChevronRight, KeyRound, Loader2, LogOut, Package, Save, UserRound } from "lucide-react";
import { initialOf, useAuth } from "../auth-provider";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/field";
import { PasswordField, PasswordStrength } from "./shared";
import { StatusBadge } from "./status-badge";
import {
  accountErrorMessage,
  accountFieldErrors,
  changePassword,
  claimOrder,
  listMyOrders,
  passwordHints,
  updateProfile,
  type OrderSummary,
} from "@/lib/account-api";
import { resolveApiUrl } from "@/lib/api";
import { fieldErrors, passwordChangeSchema, profileSchema, trackingSchema } from "@/lib/schemas";
import { SHOW_PRICES } from "@/config/pricing-display";
import { formatHTG } from "@/lib/utils";

const PAGE_SIZE = 5;
const dateFmt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

function Card({ id, title, icon: Icon, children, action }: { id: string; title: string; icon: typeof Package; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-[var(--radius-card)] border border-ip-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-2 text-xl font-semibold">
          <Icon className="size-5 text-ip-teal" aria-hidden="true" /> {title}
        </h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* ---------------- Orders ---------------- */

function OrdersSection() {
  const [orders, setOrders] = React.useState<OrderSummary[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading");
  const [more, setMore] = React.useState(false);

  const load = React.useCallback(async (p: number, append: boolean) => {
    if (append) setMore(true);
    else setState("loading");
    try {
      const res = await listMyOrders(p, PAGE_SIZE);
      setOrders((prev) => (append ? [...prev, ...res.items] : res.items));
      setTotal(res.meta.total);
      setPage(p);
      setState("ready");
    } catch {
      setState("error");
    } finally {
      setMore(false);
    }
  }, []);

  React.useEffect(() => {
    void load(1, false);
  }, [load]);

  if (state === "loading") {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Chargement de vos commandes">
        {[0, 1].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-ip-mist" />
        ))}
      </div>
    );
  }
  if (state === "error") {
    return (
      <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
        Impossible de charger vos commandes pour le moment.{" "}
        <button type="button" onClick={() => void load(1, false)} className="font-semibold underline">
          Réessayer
        </button>
      </div>
    );
  }
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-ip-line bg-ip-mist px-6 py-10 text-center" data-testid="orders-empty">
        <Package className="size-10 text-ip-teal" aria-hidden="true" />
        <h3 className="mt-3 text-lg font-semibold">Aucune commande pour l&apos;instant</h3>
        <p className="mt-1 max-w-md text-sm text-ip-muted">Personnalisez un article avec votre logo : vos commandes apparaîtront ici avec leur avancement.</p>
        <Link href="/personnaliser" className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-ip-sun px-5 text-sm font-bold text-ip-ink hover:bg-ip-sun-600">
          Personnaliser un article <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }
  return (
    <div>
      <ul className="space-y-3" data-testid="orders-list">
        {orders.map((o) => (
          <li key={o.reference}>
            <Link
              href={`/compte/commandes/${encodeURIComponent(o.reference)}`}
              data-testid="order-row"
              className="flex items-center gap-4 rounded-2xl border border-ip-line p-3 transition-colors hover:border-ip-teal hover:bg-ip-mist sm:p-4"
            >
              <span className="relative hidden size-16 shrink-0 overflow-hidden rounded-xl bg-ip-mist sm:block">
                {o.previewUrl ? (
                  <Image src={resolveApiUrl(o.previewUrl)} alt="" fill sizes="64px" className="object-contain" />
                ) : (
                  <Package className="absolute inset-0 m-auto size-6 text-ip-teal/60" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-bold" data-testid="order-row-ref">
                    {o.reference}
                  </span>
                  <StatusBadge status={o.status} />
                </span>
                <span className="mt-0.5 block truncate text-sm text-ip-muted">
                  {o.firstProductName ?? "Commande"}
                  {o.itemCount > 1 ? ` + ${o.itemCount - 1} autre${o.itemCount > 2 ? "s" : ""} article${o.itemCount > 2 ? "s" : ""}` : ""} · {dateFmt(o.createdAt)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                {SHOW_PRICES ? (
                  <>
                    <span className="block text-sm font-bold">{formatHTG(Number(o.subtotal))}</span>
                    <span className="block text-[11px] text-ip-muted">estimé</span>
                  </>
                ) : (
                  <span className="block text-[11px] text-ip-muted">Proforma</span>
                )}
              </span>
              <ChevronRight className="size-5 shrink-0 text-ip-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      {orders.length < total && (
        <div className="mt-4 text-center">
          <Button variant="outline" size="md" disabled={more} onClick={() => void load(page + 1, true)}>
            {more && <Loader2 className="animate-spin" aria-hidden="true" />} Voir plus de commandes ({total - orders.length})
          </Button>
        </div>
      )}
    </div>
  );
}

function ClaimOrder({ onClaimed }: { onClaimed: () => void }) {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [msg, setMsg] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const parsed = trackingSchema.safeParse({ ref: data.get("ref")?.toString() ?? "", email: data.get("claimEmail")?.toString() ?? "" });
    setMsg(null);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors({ ref: errs.ref ?? "", claimEmail: errs.email ?? "" });
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const ok = await claimOrder(parsed.data.ref.toUpperCase(), parsed.data.email);
      if (ok) {
        toast.success("Commande ajoutée à votre compte.");
        form.reset();
        onClaimed();
      } else {
        setMsg("Aucune commande ne correspond à cette référence et à cet e-mail (ou elle est déjà liée à un compte).");
      }
    } catch (err) {
      setMsg(accountErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="mt-5 rounded-2xl bg-ip-mist p-4">
      <summary className="cursor-pointer text-sm font-semibold text-ip-teal">Retrouver une commande passée sans compte</summary>
      <form onSubmit={onSubmit} noValidate className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start" data-testid="claim-form">
        <Field id="ref" label="Référence" error={errors.ref} hint="ex. IP-2026-000123">
          <Input id="ref" name="ref" aria-invalid={Boolean(errors.ref)} aria-describedby="ref-msg" />
        </Field>
        <Field id="claimEmail" label="E-mail utilisé pour la commande" error={errors.claimEmail}>
          <Input id="claimEmail" name="claimEmail" type="email" aria-invalid={Boolean(errors.claimEmail)} aria-describedby="claimEmail-msg" />
        </Field>
        <Button type="submit" variant="teal" size="md" className="sm:mt-[1.65rem]" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />} Ajouter
        </Button>
        {msg && (
          <p role="alert" className="text-sm text-red-800 sm:col-span-3">
            {msg}
          </p>
        )}
      </form>
    </details>
  );
}

/* ---------------- Profile & password ---------------- */

function ProfileSection() {
  const { user, setUser } = useAuth();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  if (!user) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const parsed = profileSchema.safeParse({ fullName: data.get("fullName")?.toString() ?? "", phone: data.get("phone")?.toString() ?? "" });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      setUser(await updateProfile({ fullName: parsed.data.fullName, phone: parsed.data.phone ? parsed.data.phone : null }));
      toast.success("Informations enregistrées.");
    } catch (err) {
      const fields = accountFieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      else toast.error(accountErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2" data-testid="profile-form">
      <Field id="profile-name" label="Nom complet" required error={errors.fullName}>
        <Input id="profile-name" name="fullName" defaultValue={user.fullName ?? ""} autoComplete="name" aria-invalid={Boolean(errors.fullName)} aria-describedby="profile-name-msg" />
      </Field>
      <Field id="profile-email" label="E-mail" hint="L'e-mail ne peut pas être modifié pour le moment.">
        <Input id="profile-email" value={user.email} readOnly aria-describedby="profile-email-msg" className="bg-ip-mist" />
      </Field>
      <Field id="profile-phone" label="Téléphone" error={errors.phone} hint="Facultatif">
        <Input id="profile-phone" name="phone" type="tel" defaultValue={user.phone ?? ""} autoComplete="tel" aria-invalid={Boolean(errors.phone)} aria-describedby="profile-phone-msg" />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" variant="teal" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />} Enregistrer
        </Button>
      </div>
    </form>
  );
}

function PasswordSection() {
  const { user } = useAuth();
  const [next, setNext] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const hints = passwordHints(next, user?.email ?? "");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const parsed = passwordChangeSchema.safeParse({
      currentPassword: data.get("currentPassword")?.toString() ?? "",
      newPassword: data.get("newPassword")?.toString() ?? "",
      confirm: data.get("confirm")?.toString() ?? "",
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const { revokedSessions } = await changePassword(parsed.data.currentPassword, parsed.data.newPassword);
      toast.success(revokedSessions > 0 ? `Mot de passe modifié. ${revokedSessions} autre${revokedSessions > 1 ? "s" : ""} appareil${revokedSessions > 1 ? "s ont été déconnectés" : " a été déconnecté"}.` : "Mot de passe modifié.");
      formRef.current?.reset();
      setNext("");
    } catch (err) {
      const fields = accountFieldErrors(err);
      const code = (err as { code?: string }).code;
      if (code === "INVALID_CURRENT_PASSWORD") setErrors({ currentPassword: accountErrorMessage(err) });
      else if (Object.keys(fields).length) setErrors({ newPassword: fields.newPassword ?? Object.values(fields)[0] });
      else toast.error(accountErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid max-w-xl gap-4" data-testid="password-form">
      <PasswordField id="current-password" name="currentPassword" label="Mot de passe actuel" autoComplete="current-password" required error={errors.currentPassword} />
      <div className="space-y-3">
        <PasswordField id="new-password" name="newPassword" label="Nouveau mot de passe" autoComplete="new-password" required error={errors.newPassword} onChange={setNext} />
        <PasswordStrength score={hints.score} items={hints.items} />
      </div>
      <PasswordField id="confirm-password" name="confirm" label="Confirmer le nouveau mot de passe" autoComplete="new-password" required error={errors.confirm} />
      <p className="text-xs text-ip-muted">Après le changement, vos autres appareils sont déconnectés ; cet appareil reste connecté.</p>
      <div>
        <Button type="submit" variant="teal" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />} Changer le mot de passe
        </Button>
      </div>
    </form>
  );
}

/* ---------------- Page ---------------- */

export function AccountDashboard() {
  const router = useRouter();
  const { user, status, logout } = useAuth();
  const [reload, setReload] = React.useState(0);
  const [leaving, setLeaving] = React.useState(false);

  React.useEffect(() => {
    // Not while signing out: the logout handler sends the customer home, this redirect must not race with it.
    if (status === "guest" && !leaving) router.replace("/connexion?next=/compte");
  }, [status, router, leaving]);

  if (status !== "authenticated" || !user) {
    return (
      <div className="container-ip space-y-4 py-10" aria-busy="true" aria-label="Chargement de votre espace client" data-testid="account-loading">
        <div className="h-28 animate-pulse rounded-2xl bg-ip-mist" />
        <div className="h-64 animate-pulse rounded-2xl bg-ip-mist" />
      </div>
    );
  }

  return (
    <div className="container-ip space-y-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] bg-ip-mist p-5 sm:p-6">
        <span aria-hidden="true" className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-ip-teal font-heading text-2xl font-bold text-white shadow-md">
          {initialOf(user)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ip-muted">Connecté en tant que</p>
          <p className="truncate text-xl font-bold" data-testid="account-name">
            {user.fullName ?? user.email}
          </p>
          <p className="truncate text-sm text-ip-muted" data-testid="account-email">
            {user.email}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={leaving}
          onClick={async () => {
            setLeaving(true);
            try {
              await logout();
              toast.success("Vous êtes déconnecté.");
              router.replace("/");
            } catch {
              setLeaving(false);
              toast.error("Déconnexion impossible pour le moment.");
            }
          }}
          data-testid="logout"
        >
          {leaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />} Se déconnecter
        </Button>
      </div>

      <Card
        id="orders-title"
        title="Mes commandes"
        icon={Package}
        action={
          <Link href="/personnaliser" className="text-sm font-semibold text-ip-teal underline-offset-2 hover:underline">
            Nouvelle commande
          </Link>
        }
      >
        <OrdersSection key={reload} />
        <ClaimOrder onClaimed={() => setReload((n) => n + 1)} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="profile-title" title="Mes informations" icon={UserRound}>
          <ProfileSection />
        </Card>
        <Card id="security-title" title="Sécurité" icon={KeyRound}>
          <PasswordSection />
        </Card>
      </div>
    </div>
  );
}
