import { StaffRole } from '@prisma/client';

/** Every permission of the back-office. Keep in sync with docs/admin-contract.md §1. */
export const PERMISSIONS = [
  'dashboard.read',
  'orders.read',
  'orders.write',
  'customers.read',
  'customers.write',
  'quotes.read',
  'quotes.write',
  'invoices.read',
  'invoices.write',
  'payments.write',
  'billing.settings',
  'products.read',
  'products.write',
  'mail.read',
  'mail.send',
  'users.manage',
  'audit.read',
  'reports.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  // ADMIN has every permission; the "only SUPER_ADMIN touches SUPER_ADMIN accounts" rule lives in the users service.
  ADMIN: PERMISSIONS,
  SALES: [
    'dashboard.read',
    'orders.read',
    'orders.write',
    'customers.read',
    'customers.write',
    'quotes.read',
    'quotes.write',
    'invoices.read',
    'products.read',
    'mail.read',
    'mail.send',
    'reports.read',
  ],
  ACCOUNTING: [
    'dashboard.read',
    'orders.read',
    'customers.read',
    'quotes.read',
    'invoices.read',
    'invoices.write',
    'payments.write',
    'billing.settings',
    'reports.read',
    'mail.read',
    'mail.send',
  ],
  PRODUCTION: ['dashboard.read', 'orders.read', 'orders.write', 'products.read'],
  SUPPORT: ['dashboard.read', 'orders.read', 'customers.read', 'customers.write', 'mail.read', 'mail.send'],
};

export const STAFF_ROLES = Object.values(StaffRole) as StaffRole[];

/** Permissions of a staff role (empty for customers / unknown). */
export function permissionsFor(role: StaffRole | null | undefined): Permission[] {
  return role ? [...ROLE_PERMISSIONS[role]] : [];
}

export const hasPermission = (role: StaffRole | null | undefined, permission: Permission): boolean =>
  Boolean(role) && ROLE_PERMISSIONS[role as StaffRole].includes(permission);
