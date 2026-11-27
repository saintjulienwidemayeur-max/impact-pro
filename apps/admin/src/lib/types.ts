/** Entity shapes of the admin API (docs/admin-contract.md §2–§4). */
import type { Permission, StaffRole } from "./permissions";

export interface Meta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface Paged<T> {
  data: T[];
  meta: Meta;
}

export interface AdminMe {
  id: string;
  email: string;
  fullName: string | null;
  staffRole: StaffRole;
  permissions: Permission[];
  mustChangePassword: boolean;
}

export type OrderStatus = "RECEIVED" | "MOCKUP_SENT" | "APPROVED" | "IN_PRODUCTION" | "READY" | "DELIVERED" | "CANCELLED";
export const ORDER_FLOW: OrderStatus[] = ["RECEIVED", "MOCKUP_SENT", "APPROVED", "IN_PRODUCTION", "READY", "DELIVERED"];

export interface OrderListItem {
  id: string;
  reference: string;
  status: OrderStatus;
  currency: string;
  subtotal: string;
  customerName: string;
  company?: string | null;
  email: string;
  phone: string;
  itemCount: number;
  createdAt: string;
  customerId?: string | null;
  hasDocuments: boolean;
}

export interface OrderElement {
  placement: string;
  kind: "LOGO" | "TEXT" | "ARTWORK";
  text?: string | null;
  font?: string | null;
  fontWeight?: string | null;
  color?: string | null;
  align?: string | null;
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  sort?: number;
  logoUrl?: string | null;
  originalName?: string | null;
}
export interface OrderItem {
  id: string;
  lineNo: number;
  productId?: string;
  productSlug: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  color?: string | null;
  size?: string | null;
  widthCm?: number | null;
  heightCm?: number | null;
  areaM2?: number | null;
  notes?: string | null;
  elements: OrderElement[];
  previews: { placement: string; url: string }[];
}
export interface OrderEvent {
  id: string;
  type: "STATUS" | "NOTE" | "DOCUMENT" | "EMAIL";
  message: string;
  data?: Record<string, unknown> | null;
  actor: { id: string; name: string } | null;
  createdAt: string;
}
export interface OrderDetail extends OrderListItem {
  city?: string | null;
  address?: string | null;
  deliveryMethod: "PICKUP" | "DELIVERY";
  notes?: string | null;
  customer: CustomerListItem | null;
  items: OrderItem[];
  documents: DocumentSummary[];
  events: OrderEvent[];
}

export interface CustomerBalance {
  currency: string;
  billed: string;
  paid: string;
  due: string;
}
export interface Customer {
  id: string;
  email: string;
  fullName: string;
  company?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  taxId?: string | null;
  notes?: string | null;
  userId?: string | null;
  source?: "ORDER" | "ADMIN" | "ACCOUNT";
  createdAt: string;
}
export interface CustomerListItem extends Customer {
  ordersCount: number;
  lastOrderAt?: string | null;
  balances: CustomerBalance[];
}
export interface CustomerDetail extends CustomerListItem {
  orders: OrderListItem[];
  documents: DocumentSummary[];
}

export type DocumentType = "QUOTE" | "PROFORMA" | "INVOICE";
export type DocumentStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "PARTIALLY_PAID" | "PAID" | "VOID";
export type PaymentMethod = "CASH" | "MONCASH" | "NATCASH" | "BANK_TRANSFER" | "ZELLE" | "CARD" | "CHECK" | "OTHER";

export interface DocumentSummary {
  id: string;
  type: DocumentType;
  number: string;
  status: DocumentStatus;
  isOverdue: boolean;
  currency: string;
  total: string;
  balance: string;
  issueDate: string;
  customerName: string;
  createdAt?: string;
}
export interface DocumentLine {
  id?: string;
  position?: number;
  description: string;
  sku?: string | null;
  productId?: string | null;
  quantity: number;
  unit?: string | null;
  unitPrice: string;
  discountPercent: number;
  lineTotal?: string;
}
export interface DocumentCustomer {
  name: string;
  company?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  taxId?: string | null;
}
export interface Payment {
  id: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  paidAt: string;
  reference?: string | null;
  notes?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  recordedBy: { id: string; name: string };
}
export interface DocumentEvent {
  id: string;
  type: string;
  message: string;
  actor: { id: string; name: string } | null;
  createdAt: string;
}
export interface BillingDocument {
  id: string;
  type: DocumentType;
  number: string;
  status: DocumentStatus;
  isOverdue: boolean;
  currency: string;
  issueDate: string;
  dueDate?: string | null;
  validUntil?: string | null;
  customerId?: string | null;
  customer: DocumentCustomer;
  orderId?: string | null;
  orderReference?: string | null;
  parentId?: string | null;
  parentNumber?: string | null;
  children: { id: string; type: DocumentType; number: string }[];
  lines: DocumentLine[];
  discountAmount: string;
  shippingAmount: string;
  taxRate: number;
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  balance: string;
  notes?: string | null;
  internalNotes?: string | null;
  terms?: string | null;
  paymentInstructions?: string | null;
  sentAt?: string | null;
  sentTo?: string[] | null;
  acceptedAt?: string | null;
  publicToken?: string | null;
  publicUrl?: string | null;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  payments: Payment[];
  events: DocumentEvent[];
}

export interface BillingSettings {
  legalName: string;
  address: string;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  taxId?: string | null;
  defaultCurrency: string;
  defaultTaxRate: number;
  paymentTermsDays: number;
  quoteValidityDays: number;
  prefixes: { quote: string; proforma: string; invoice: string };
  bankDetails?: string | null;
  paymentInstructions?: string | null;
  defaultTerms?: string | null;
  footerNote?: string | null;
  logoUrl?: string | null;
}

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  category: { id: string; slug: string; name: string };
  basePrice: string;
  compareAtPrice?: string | null;
  currency: string;
  minQty: number;
  unitLabel: string;
  colors: string[];
  sizes: string[];
  colorLabel: string;
  sizeLabel: string;
  colorsRequired: boolean;
  sizesRequired: boolean;
  placements: string[];
  pricingMode: "PER_PIECE" | "PER_AREA";
  supportsLogo: boolean;
  supportsText: boolean;
  supportsArtwork: boolean;
  artworkRequired: boolean;
  customSize?: Record<string, number> | null;
  priceTiers: { minQty: number; unitPrice: string }[];
  updatedAt: string;
}

export interface StaffUser {
  id: string;
  email: string;
  fullName: string | null;
  staffRole: StaffRole;
  status: string;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  actor: { id: string; name: string } | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface Dashboard {
  generatedAt: string;
  orders: { total: number; byStatus: Record<string, number>; last7d: number; last30d: number };
  revenue: { currency: string; paid7d: string; paid30d: string; outstanding: string; overdue: string }[];
  customers: { total: number; new30d: number };
  documents: { draftQuotes: number; openQuotes: number; unpaidInvoices: number; overdueInvoices: number };
  mail: { unread: number } | null;
  recentOrders: OrderListItem[];
  topProducts: { productName: string; quantity: number; orders: number }[];
  activity: AuditEntry[];
}

export interface RevenueRow {
  period: string;
  currency: string;
  invoiced: string;
  paid: string;
}
export interface AgingRow {
  currency: string;
  current: string;
  d1_30: string;
  d31_60: string;
  d61_plus: string;
  total: string;
}
