import type { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  /** Customers are `CUSTOMER`; Impact Pro employees are `STAFF` (staff tools come in later phases). */
  role: 'CUSTOMER' | 'STAFF';
  /** No e-mail service yet: always false until verification ships. */
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthContext {
  sessionId: string;
  /** Raw session token from the cookie (never stored). */
  token: string;
  csrfToken: string;
  user: AuthUser;
}

export type AuthedRequest = Request & { auth?: AuthContext; id?: string };
