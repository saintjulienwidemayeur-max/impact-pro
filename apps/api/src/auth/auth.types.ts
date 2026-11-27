import type { StaffRole } from '@prisma/client';
import type { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  /** Customers are `CUSTOMER`; Impact Pro employees are `STAFF`. */
  role: 'CUSTOMER' | 'STAFF';
  /** No e-mail service yet: always false until verification ships. */
  emailVerified: boolean;
  createdAt: string;
  /** Staff only (omitted for customers): back-office role, permissions and the forced-password-change flag. */
  isStaff?: true;
  staffRole?: StaffRole | null;
  permissions?: string[];
  mustChangePassword?: boolean;
}

export interface AuthContext {
  sessionId: string;
  /** Raw session token from the cookie (never stored). */
  token: string;
  csrfToken: string;
  user: AuthUser;
}

export type AuthedRequest = Request & { auth?: AuthContext; id?: string };
