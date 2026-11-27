/**
 * Port between the admin core (dashboard, customers, orders) and the billing module (quotes / proformas / invoices).
 * The core only needs read-only aggregates, so billing can be merged independently: `AdminModule` binds this token to
 * `ZeroBillingStatsProvider`; when billing lands, rebind it to the real implementation, e.g.
 *   { provide: BILLING_STATS, useExisting: DocumentsStatsService }
 */
export const BILLING_STATS = Symbol('BILLING_STATS');

/** Same shape as the billing contract (docs/admin-contract.md §3). */
export interface DocumentSummary {
  id: string;
  type: 'QUOTE' | 'PROFORMA' | 'INVOICE';
  number: string;
  status: string;
  isOverdue: boolean;
  currency: string;
  total: string;
  balance: string;
  issueDate: string;
  customerName: string;
}

export interface CurrencyBalance {
  currency: string;
  billed: string;
  paid: string;
  due: string;
}

export interface RevenueByCurrency {
  currency: string;
  paid7d: string;
  paid30d: string;
  outstanding: string;
  overdue: string;
}

export interface BillingDashboardStats {
  revenue: RevenueByCurrency[];
  documents: { draftQuotes: number; openQuotes: number; unpaidInvoices: number; overdueInvoices: number };
}

export interface BillingStatsProvider {
  dashboard(): Promise<BillingDashboardStats>;
  /** customerId → balances per currency (customers without documents may be omitted). */
  balancesByCustomer(customerIds: string[]): Promise<Record<string, CurrencyBalance[]>>;
  documentsForCustomer(customerId: string): Promise<DocumentSummary[]>;
  documentsForOrder(orderId: string): Promise<DocumentSummary[]>;
  /** Ids (among `orderIds`) that have at least one document. */
  orderIdsWithDocuments(orderIds: string[]): Promise<Set<string>>;
}

/** Default until billing is merged: no documents, zero amounts. */
export class ZeroBillingStatsProvider implements BillingStatsProvider {
  dashboard(): Promise<BillingDashboardStats> {
    return Promise.resolve({ revenue: [], documents: { draftQuotes: 0, openQuotes: 0, unpaidInvoices: 0, overdueInvoices: 0 } });
  }
  balancesByCustomer(): Promise<Record<string, CurrencyBalance[]>> {
    return Promise.resolve({});
  }
  documentsForCustomer(): Promise<DocumentSummary[]> {
    return Promise.resolve([]);
  }
  documentsForOrder(): Promise<DocumentSummary[]> {
    return Promise.resolve([]);
  }
  orderIdsWithDocuments(): Promise<Set<string>> {
    return Promise.resolve(new Set());
  }
}
