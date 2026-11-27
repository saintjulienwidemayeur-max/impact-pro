/** Staff permissions (docs/admin-contract.md §1). The server stays the authority; this only drives what the UI shows. */
export const ALL_PERMISSIONS = [
  "dashboard.read",
  "orders.read",
  "orders.write",
  "customers.read",
  "customers.write",
  "quotes.read",
  "quotes.write",
  "invoices.read",
  "invoices.write",
  "payments.write",
  "billing.settings",
  "products.read",
  "products.write",
  "mail.read",
  "mail.send",
  "users.manage",
  "audit.read",
  "reports.read",
] as const;
export type Permission = (typeof ALL_PERMISSIONS)[number];

export type StaffRole = "SUPER_ADMIN" | "ADMIN" | "SALES" | "ACCOUNTING" | "PRODUCTION" | "SUPPORT";

export const STAFF_ROLES: { value: StaffRole; label: string }[] = [
  { value: "SUPER_ADMIN", label: "Super administrateur" },
  { value: "ADMIN", label: "Administrateur" },
  { value: "SALES", label: "Ventes" },
  { value: "ACCOUNTING", label: "Comptabilité" },
  { value: "PRODUCTION", label: "Production" },
  { value: "SUPPORT", label: "Support" },
];
export const roleLabel = (r: string | null | undefined): string => STAFF_ROLES.find((x) => x.value === r)?.label ?? r ?? "—";

interface HasPermissions {
  permissions?: readonly string[] | null;
}

export function can(user: HasPermissions | null | undefined, perm: Permission): boolean {
  return Boolean(user?.permissions?.includes(perm));
}
export const canAny = (user: HasPermissions | null | undefined, perms: readonly Permission[]): boolean => perms.some((p) => can(user, p));

/** Which permission unlocks which document type. */
export function documentReadPerm(type: "QUOTE" | "PROFORMA" | "INVOICE"): Permission {
  return type === "INVOICE" ? "invoices.read" : "quotes.read";
}
export function documentWritePerm(type: "QUOTE" | "PROFORMA" | "INVOICE"): Permission {
  return type === "INVOICE" ? "invoices.write" : "quotes.write";
}
