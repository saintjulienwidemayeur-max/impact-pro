import { Injectable } from '@nestjs/common';
import { DocumentType, type BillingSettings } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { BillingSettingsDto } from './dto/billing.dto';

const SINGLETON = 'singleton';

export interface BillingSettingsView {
  legalName: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string | null;
  taxId: string | null;
  defaultCurrency: string;
  defaultTaxRate: string;
  paymentTermsDays: number;
  quoteValidityDays: number;
  prefixes: { quote: string; proforma: string; invoice: string };
  bankDetails: string | null;
  paymentInstructions: string | null;
  defaultTerms: string | null;
  footerNote: string | null;
  logoUrl: string | null;
  /** Read-only: the numbers the next documents of this year will receive. */
  nextNumbers: { quote: string; proforma: string; invoice: string };
  updatedAt: string;
}

/** Defaults for Impact Pro LLC (Miami, Florida, USA). Phone, e-mail and bank details are placeholders to complete in the admin. */
export const DEFAULT_SETTINGS = {
  legalName: 'Impact Pro LLC',
  address: "[Adresse de l'entreprise]",
  city: 'Miami, Floride',
  country: 'États-Unis',
  phone: '+509 [XXXX-XXXX]',
  email: 'contact@impactpro.ht',
  website: null,
  taxId: null,
  defaultCurrency: 'HTG',
  defaultTaxRate: 0,
  paymentTermsDays: 15,
  quoteValidityDays: 30,
  prefixQuote: 'DEV',
  prefixProforma: 'PRO',
  prefixInvoice: 'FAC',
  bankDetails: '[Coordonnées bancaires à compléter : banque, titulaire, numéro de compte, SWIFT/ABA]',
  paymentInstructions: 'Paiement par MonCash, NatCash, virement bancaire ou Zelle. [Coordonnées à compléter]',
  defaultTerms:
    "Devis valable 30 jours. Acompte de 50 % à la commande, solde à la livraison. La production démarre après réception de l'acompte et validation de la maquette.",
  footerNote: 'Impact Pro LLC — Votre marque, partout.',
  logoUrl: null,
} as const;

@Injectable()
export class BillingSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Singleton row, created with the defaults on first access. */
  async getRow(): Promise<BillingSettings> {
    const existing = await this.prisma.billingSettings.findUnique({ where: { id: SINGLETON } });
    if (existing) return existing;
    return this.prisma.billingSettings.upsert({ where: { id: SINGLETON }, update: {}, create: { id: SINGLETON, ...DEFAULT_SETTINGS } });
  }

  async get(): Promise<BillingSettingsView> {
    return this.toView(await this.getRow());
  }

  async update(dto: BillingSettingsDto, actorId: string, ctx: { ipAddress?: string; requestId?: string } = {}): Promise<BillingSettingsView> {
    await this.getRow();
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.billingSettings.update({
        where: { id: SINGLETON },
        data: {
          legalName: dto.legalName,
          address: dto.address,
          city: dto.city,
          country: dto.country,
          phone: dto.phone,
          email: dto.email,
          website: dto.website ?? null,
          taxId: dto.taxId ?? null,
          defaultCurrency: dto.defaultCurrency,
          defaultTaxRate: dto.defaultTaxRate,
          paymentTermsDays: dto.paymentTermsDays,
          quoteValidityDays: dto.quoteValidityDays,
          prefixQuote: dto.prefixes.quote,
          prefixProforma: dto.prefixes.proforma,
          prefixInvoice: dto.prefixes.invoice,
          bankDetails: dto.bankDetails ?? null,
          paymentInstructions: dto.paymentInstructions ?? null,
          defaultTerms: dto.defaultTerms ?? null,
          footerNote: dto.footerNote ?? null,
          logoUrl: dto.logoUrl ?? null,
        },
      });
      await tx.auditLog.create({
        data: { action: 'billing.settings.update', entityType: 'BillingSettings', entityId: SINGLETON, actorId, metadata: { prefixes: { ...dto.prefixes }, defaultCurrency: dto.defaultCurrency }, ipAddress: ctx.ipAddress ?? null, requestId: ctx.requestId ?? null },
      });
      return updated;
    });
    return this.toView(row);
  }

  prefixFor(settings: BillingSettings, type: DocumentType): string {
    return type === DocumentType.QUOTE ? settings.prefixQuote : type === DocumentType.PROFORMA ? settings.prefixProforma : settings.prefixInvoice;
  }

  private async toView(s: BillingSettings): Promise<BillingSettingsView> {
    const year = new Date().getUTCFullYear();
    const counters = await this.prisma.documentCounter.findMany({ where: { year } });
    const next = (type: DocumentType) => {
      const last = counters.find((c) => c.type === type)?.last ?? 0;
      return `${this.prefixFor(s, type)}-${year}-${String(last + 1).padStart(4, '0')}`;
    };
    return {
      legalName: s.legalName,
      address: s.address,
      city: s.city,
      country: s.country,
      phone: s.phone,
      email: s.email,
      website: s.website,
      taxId: s.taxId,
      defaultCurrency: s.defaultCurrency,
      defaultTaxRate: s.defaultTaxRate.toFixed(2),
      paymentTermsDays: s.paymentTermsDays,
      quoteValidityDays: s.quoteValidityDays,
      prefixes: { quote: s.prefixQuote, proforma: s.prefixProforma, invoice: s.prefixInvoice },
      bankDetails: s.bankDetails,
      paymentInstructions: s.paymentInstructions,
      defaultTerms: s.defaultTerms,
      footerNote: s.footerNote,
      logoUrl: s.logoUrl,
      nextNumbers: { quote: next(DocumentType.QUOTE), proforma: next(DocumentType.PROFORMA), invoice: next(DocumentType.INVOICE) },
      updatedAt: s.updatedAt.toISOString(),
    };
  }
}
