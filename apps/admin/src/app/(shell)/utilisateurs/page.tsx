"use client";

import { KeyRound, Loader2, UserPlus } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Gate } from "@/components/gate";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge, ConfirmDialog, CopyButton, Dialog, EmptyState, ErrorState, PageHeader, TableSkeleton, TableWrap, Td, Th } from "@/components/ui/kit";
import { ApiError, patch, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateFr } from "@/lib/format";
import { useFetch } from "@/lib/hooks";
import { roleLabel, STAFF_ROLES, type StaffRole } from "@/lib/permissions";
import type { StaffUser } from "@/lib/types";

export default function UsersPage() {
  return (
    <Gate perm="users.manage">
      <Inner />
    </Gate>
  );
}

const createSchema = z.object({
  fullName: z.string().trim().min(2, "Nom complet requis."),
  email: z.string().trim().email("Adresse e-mail invalide."),
});

function Inner() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch<StaffUser[]>("/admin/users");
  const [creating, setCreating] = React.useState(false);
  const [temp, setTemp] = React.useState<{ email: string; password: string } | null>(null);
  const [resetFor, setResetFor] = React.useState<StaffUser | null>(null);
  const [busy, setBusy] = React.useState(false);
  const isSuper = user?.staffRole === "SUPER_ADMIN";
  const roles = STAFF_ROLES.filter((r) => isSuper || r.value !== "SUPER_ADMIN");

  async function update(u: StaffUser, body: { staffRole?: StaffRole; status?: string }) {
    try {
      await patch(`/admin/users/${u.id}`, body);
      toast.success("Utilisateur mis à jour.");
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Mise à jour impossible.");
      reload();
    }
  }

  async function reset() {
    if (!resetFor) return;
    setBusy(true);
    try {
      const r = await post<{ temporaryPassword: string }>(`/admin/users/${resetFor.id}/reset-password`);
      setTemp({ email: resetFor.email, password: r.temporaryPassword });
      setResetFor(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Réinitialisation impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Utilisateurs & rôles"
        subtitle="Les membres de l'équipe qui accèdent à l'administration."
        actions={
          <Button variant="sun" size="sm" onClick={() => setCreating(true)} data-testid="user-new">
            <UserPlus /> Nouvel utilisateur
          </Button>
        }
      />
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <TableSkeleton cols={5} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="Aucun utilisateur" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Utilisateur</Th>
              <Th>Rôle</Th>
              <Th>Statut</Th>
              <Th>Dernière connexion</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody data-testid="users-rows">
            {(data ?? []).map((u) => {
              const self = u.id === user?.id;
              const locked = u.staffRole === "SUPER_ADMIN" && !isSuper;
              return (
                <tr key={u.id} className="border-t border-ip-line">
                  <Td>
                    <span className="font-semibold">{u.fullName ?? "—"}</span> {self && <Badge tone="cyan">Vous</Badge>}
                    <span className="block text-xs text-ip-muted">{u.email}</span>
                  </Td>
                  <Td>
                    <Select aria-label={`Rôle de ${u.email}`} value={u.staffRole} disabled={self || locked} onChange={(e) => void update(u, { staffRole: e.target.value as StaffRole })} className="h-9 min-w-40" data-testid="user-role-select">
                      {(locked ? STAFF_ROLES : roles).map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <Badge tone={u.status === "ACTIVE" ? "green" : "gray"}>{u.status === "ACTIVE" ? "Actif" : "Désactivé"}</Badge>
                  </Td>
                  <Td>{u.lastLoginAt ? dateFr(u.lastLoginAt, true) : "Jamais"}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" disabled={locked} onClick={() => setResetFor(u)} data-testid="user-reset">
                        <KeyRound /> Mot de passe
                      </Button>
                      <Button size="sm" variant="ghost" disabled={self || locked} onClick={() => void update(u, { status: u.status === "ACTIVE" ? "DISABLED" : "ACTIVE" })} data-testid="user-toggle">
                        {u.status === "ACTIVE" ? "Désactiver" : "Réactiver"}
                      </Button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}

      <CreateDialog
        open={creating}
        roles={roles}
        onClose={() => setCreating(false)}
        onCreated={(email, password) => {
          setCreating(false);
          setTemp({ email, password });
          reload();
        }}
      />

      <ConfirmDialog open={!!resetFor} onClose={() => setResetFor(null)} onConfirm={() => void reset()} busy={busy} danger title="Réinitialiser le mot de passe ?" message={`Un mot de passe temporaire sera généré pour ${resetFor?.email ?? ""}. Les sessions en cours seront fermées et le changement sera exigé à la prochaine connexion.`} confirmLabel="Réinitialiser" />

      <Dialog open={!!temp} onClose={() => setTemp(null)} title="Mot de passe temporaire" testId="temp-password-dialog" footer={<Button onClick={() => setTemp(null)} data-testid="temp-close">J&apos;ai copié le mot de passe</Button>}>
        <p className="mb-3 text-sm">
          Transmettez ce mot de passe à <strong>{temp?.email}</strong> de façon sûre. <strong>Il ne sera plus jamais affiché.</strong> L&apos;utilisateur devra le changer à sa première connexion.
        </p>
        <div className="flex items-center gap-2 rounded-xl bg-ip-mist p-3">
          <code className="flex-1 break-all font-mono text-base font-semibold" data-testid="temp-password">
            {temp?.password}
          </code>
          <CopyButton value={temp?.password ?? ""} label="Copier" />
        </div>
      </Dialog>
    </>
  );
}

function CreateDialog({ open, roles, onClose, onCreated }: { open: boolean; roles: { value: StaffRole; label: string }[]; onClose: () => void; onCreated: (email: string, password: string) => void }) {
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<StaffRole>("SALES");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setFullName("");
      setEmail("");
      setRole("SALES");
      setErrors({});
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createSchema.safeParse({ fullName, email });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
      setErrors(errs);
      return;
    }
    setBusy(true);
    try {
      const r = await post<{ temporaryPassword: string }>("/admin/users", { ...parsed.data, staffRole: role });
      onCreated(parsed.data.email, r.temporaryPassword);
    } catch (err) {
      if (err instanceof ApiError) setErrors({ ...err.fieldErrors(), ...(err.status === 409 ? { email: "Cette adresse existe déjà." } : {}), ...(Object.keys(err.fieldErrors()).length || err.status === 409 ? {} : { form: err.message }) });
      else setErrors({ form: "Création impossible." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nouvel utilisateur"
      testId="user-dialog"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="user-form" disabled={busy} data-testid="user-create">
            {busy && <Loader2 className="animate-spin" />} Créer le compte
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} noValidate className="grid gap-3">
        {errors.form && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {errors.form}
          </p>
        )}
        <Field id="u-name" label="Nom complet" required error={errors.fullName}>
          <Input id="u-name" value={fullName} onChange={(e) => setFullName(e.target.value)} data-testid="user-name" />
        </Field>
        <Field id="u-email" label="E-mail" required error={errors.email}>
          <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="user-email" />
        </Field>
        <Field id="u-role" label="Rôle">
          <Select id="u-role" value={role} onChange={(e) => setRole(e.target.value as StaffRole)} data-testid="user-role-new">
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-ip-muted">Un mot de passe temporaire est généré et affiché une seule fois. Rôle actuel choisi : {roleLabel(role)}.</p>
      </form>
    </Dialog>
  );
}
