import type { DocumentStatus, DocumentType, PaymentMethod } from '@prisma/client';

export interface ActorRef {
  id: string;
  name: string;
}

export interface PaymentView {
  id: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  paidAt: string;
  reference: string | null;
  notes: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  recordedBy: ActorRef | null;
}

export interface DocumentLineView {
  id: string;
  position: number;
  description: string;
  sku: string | null;
  productId: string | null;
  quantity: string;
  unit: string | null;
  unitPrice: string;
  discountPercent: string;
  lineTotal: string;
}

export interface DocumentEventView {
  id: string;
  type: string;
  message: string;
  actor: ActorRef | null;
  createdAt: string;
}

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
  createdAt: string;
}

export interface DocumentView {
  id: string;
  type: DocumentType;
  number: string;
  status: DocumentStatus;
  isOverdue: boolean;
  currency: string;
  issueDate: string;
  dueDate: string | null;
  validUntil: string | null;
  customerId: string | null;
  customer: {
    name: string;
    company: string | null;
    email: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    taxId: string | null;
  };
  orderId: string | null;
  orderReference: string | null;
  parentId: string | null;
  parentNumber: string | null;
  children: { id: string; type: DocumentType; number: string }[];
  lines: DocumentLineView[];
  discountAmount: string;
  shippingAmount: string;
  taxRate: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  balance: string;
  notes: string | null;
  internalNotes: string | null;
  terms: string | null;
  paymentInstructions: string | null;
  sentAt: string | null;
  sentTo: string[];
  acceptedAt: string | null;
  publicToken: string | null;
  publicUrl: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdBy: ActorRef | null;
  createdAt: string;
  updatedAt: string;
  payments: PaymentView[];
  events: DocumentEventView[];
}

/** What a customer sees through a public link: no internal notes, events, ids or staff names. */
export interface PublicDocumentView {
  type: DocumentType;
  number: string;
  status: DocumentStatus;
  currency: string;
  issueDate: string;
  dueDate: string | null;
  validUntil: string | null;
  company: { legalName: string; address: string; city: string; country: string; phone: string; email: string; website: string | null; taxId: string | null };
  customer: { name: string; company: string | null; email: string };
  lines: { position: number; description: string; quantity: string; unit: string | null; unitPrice: string; discountPercent: string; lineTotal: string }[];
  discountAmount: string;
  shippingAmount: string;
  taxRate: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  balance: string;
  notes: string | null;
  terms: string | null;
  paymentInstructions: string | null;
  acceptedAt: string | null;
  canAccept: boolean;
}
