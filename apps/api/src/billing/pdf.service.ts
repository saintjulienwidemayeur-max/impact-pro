import { Injectable } from '@nestjs/common';
import type { BillingSettings } from '@prisma/client';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import type { DocumentView } from './billing.types';

const TEAL = '#0A716A';
const INK = '#0E2A2E';
const GRAY = '#5B6B6E';
const LIGHT = '#F2F6F5';
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 40;
const CONTENT_W = PAGE_W - 2 * M;
const BOTTOM = PAGE_H - 70; // keep room for the footer

const TITLE: Record<string, string> = { QUOTE: 'DEVIS', PROFORMA: 'FACTURE PROFORMA', INVOICE: 'FACTURE' };
const STATUS_FR: Record<string, string> = {
  DRAFT: 'Brouillon', SENT: 'Envoyé', ACCEPTED: 'Accepté', REJECTED: 'Refusé', EXPIRED: 'Expiré', PARTIALLY_PAID: 'Partiellement payé', PAID: 'Payé', VOID: 'Annulé',
};
const METHOD_FR: Record<string, string> = {
  CASH: 'Espèces', MONCASH: 'MonCash', NATCASH: 'NatCash', BANK_TRANSFER: 'Virement', ZELLE: 'Zelle', CARD: 'Carte', CHECK: 'Chèque', OTHER: 'Autre',
};

/** `1250.5` → `1 250,50` (plain spaces: Helvetica/WinAnsi has no narrow no-break space). */
export function formatAmount(v: string): string {
  const neg = v.startsWith('-');
  const [int, dec = '00'] = v.replace('-', '').split('.');
  return `${neg ? '-' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${dec.padEnd(2, '0').slice(0, 2)}`;
}

const fmtDate = (iso: string | null): string => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const LOGO_PATH = join(__dirname, '..', '..', 'assets', 'logo-impact-pro.png');

@Injectable()
export class PdfService {
  /** Renders a quote / proforma / invoice as an A4 PDF (header, parties, paginated lines table, totals, payments, terms). */
  render(view: DocumentView, settings: BillingSettings): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: M, bottom: 40, left: M, right: M },
        bufferPages: true,
        info: { Title: `${TITLE[view.type]} ${view.number}`, Author: settings.legalName, Subject: `${TITLE[view.type]} ${view.number}` },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        this.draw(doc, view, settings);
        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  private draw(doc: PDFKit.PDFDocument, v: DocumentView, s: BillingSettings): void {
    // --- Header: logo + company block ---------------------------------------------------------------------------------
    if (existsSync(LOGO_PATH)) doc.image(LOGO_PATH, M, 34, { width: 135 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(s.legalName, 300, 38, { width: PAGE_W - M - 300, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(GRAY);
    for (const line of [s.address, [s.city, s.country].filter(Boolean).join(', '), s.phone, s.email, s.taxId ? `ID fiscal : ${s.taxId}` : ''].filter(Boolean)) {
      doc.text(line, 300, doc.y, { width: PAGE_W - M - 300, align: 'right' });
    }

    // --- Title + meta -------------------------------------------------------------------------------------------------
    let y = 118;
    doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(22).text(TITLE[v.type], M, y, { width: 300 });
    doc.fillColor(INK).fontSize(12).text(`N° ${v.number}`, M, doc.y + 2);
    if (v.type === 'PROFORMA') {
      doc.fillColor('#9A3412').font('Helvetica-Oblique').fontSize(8.5).text("FACTURE PROFORMA — n'est pas une facture fiscale", M, doc.y + 3, { width: 300 });
    }
    const meta: [string, string][] = [
      ["Date d'émission", fmtDate(v.issueDate)],
      ...(v.type === 'INVOICE' && v.dueDate ? ([["Échéance", fmtDate(v.dueDate)]] as [string, string][]) : []),
      ...(v.type !== 'INVOICE' && v.validUntil ? ([['Valable jusqu\'au', fmtDate(v.validUntil)]] as [string, string][]) : []),
      ...(v.orderReference ? ([['Commande', v.orderReference]] as [string, string][]) : []),
      ['Statut', STATUS_FR[v.status] ?? v.status],
    ];
    let my = y;
    for (const [k, val] of meta) {
      doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(k, 360, my, { width: 90 });
      doc.font('Helvetica-Bold').fillColor(INK).text(val, 452, my, { width: 103, align: 'right' });
      my += 14;
    }
    y = Math.max(doc.y, my) + 16;

    // --- Customer -----------------------------------------------------------------------------------------------------
    const c = v.customer;
    const custLines = [c.company, c.address, [c.city, c.country].filter(Boolean).join(', '), c.email, c.phone, c.taxId ? `ID fiscal : ${c.taxId}` : ''].filter(Boolean) as string[];
    const custH = 28 + 12 * (custLines.length + 1);
    doc.roundedRect(M, y, 260, custH, 6).fill(LIGHT);
    doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(8.5).text(v.type === 'QUOTE' ? 'DESTINATAIRE' : 'FACTURÉ À', M + 10, y + 8);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(c.name, M + 10, y + 21, { width: 240 });
    doc.font('Helvetica').fontSize(9).fillColor(GRAY);
    for (const l of custLines) doc.text(l, M + 10, doc.y, { width: 240 });
    y += custH + 18;

    // --- Lines table --------------------------------------------------------------------------------------------------
    const cols = { desc: M, qty: M + 240, unit: M + 285, disc: M + 365, total: M + 420 };
    const widths = { desc: 232, qty: 40, unit: 76, disc: 50, total: 95 };
    const header = (yy: number): number => {
      doc.rect(M, yy, CONTENT_W, 20).fill(TEAL);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
      doc.text('Description', cols.desc + 6, yy + 6, { width: widths.desc });
      doc.text('Qté', cols.qty, yy + 6, { width: widths.qty, align: 'right' });
      doc.text('Prix unitaire', cols.unit, yy + 6, { width: widths.unit, align: 'right' });
      doc.text('Remise', cols.disc, yy + 6, { width: widths.disc, align: 'right' });
      doc.text(`Total (${v.currency})`, cols.total, yy + 6, { width: widths.total - 6, align: 'right' });
      return yy + 20;
    };
    y = header(y);
    v.lines.forEach((l, i) => {
      doc.font('Helvetica').fontSize(9);
      const h = Math.max(doc.heightOfString(l.description, { width: widths.desc - 6 }), 11) + 10;
      if (y + h > BOTTOM) {
        doc.addPage();
        y = header(M);
      }
      if (i % 2 === 1) doc.rect(M, y, CONTENT_W, h).fill('#FAFCFB');
      doc.fillColor(INK).text(l.description, cols.desc + 6, y + 5, { width: widths.desc - 6 });
      doc.text(l.unit ? `${l.quantity} ${l.unit}` : l.quantity, cols.qty, y + 5, { width: widths.qty, align: 'right' });
      doc.text(formatAmount(l.unitPrice), cols.unit, y + 5, { width: widths.unit, align: 'right' });
      doc.text(Number(l.discountPercent) > 0 ? `${l.discountPercent} %` : '—', cols.disc, y + 5, { width: widths.disc, align: 'right' });
      doc.font('Helvetica-Bold').text(formatAmount(l.lineTotal), cols.total, y + 5, { width: widths.total - 6, align: 'right' });
      doc.moveTo(M, y + h).lineTo(M + CONTENT_W, y + h).lineWidth(0.4).strokeColor('#DDE5E3').stroke();
      y += h;
    });
    if (v.lines.length === 0) {
      doc.fillColor(GRAY).font('Helvetica-Oblique').fontSize(9).text('Aucune ligne.', cols.desc + 6, y + 6);
      y += 24;
    }

    // --- Totals -------------------------------------------------------------------------------------------------------
    const rows: [string, string, boolean?][] = [['Sous-total', formatAmount(v.subtotal)]];
    if (Number(v.discountAmount) > 0) rows.push(['Remise', `-${formatAmount(v.discountAmount)}`]);
    if (Number(v.shippingAmount) > 0) rows.push(['Livraison', formatAmount(v.shippingAmount)]);
    if (Number(v.taxRate) > 0) rows.push([`Taxe (${v.taxRate} %)`, formatAmount(v.taxTotal)]);
    rows.push([`TOTAL ${v.currency}`, formatAmount(v.total), true]);
    const activePayments = v.payments.filter((p) => !p.voidedAt);
    if (v.type === 'INVOICE') {
      rows.push(['Payé', formatAmount(v.amountPaid)]);
      rows.push(['Solde dû', formatAmount(v.balance), true]);
    }
    const totalsH = rows.length * 17 + 12;
    if (y + totalsH > BOTTOM) {
      doc.addPage();
      y = M;
    }
    y += 10;
    for (const [k, val, strong] of rows) {
      if (strong) doc.rect(330, y - 3, PAGE_W - M - 330, 19).fill(TEAL);
      doc.font(strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(strong ? 10 : 9.5).fillColor(strong ? '#FFFFFF' : INK);
      doc.text(k, 338, y + (strong ? 1 : 0), { width: 120 });
      doc.text(val, 440, y + (strong ? 1 : 0), { width: PAGE_W - M - 440 - 8, align: 'right' });
      y += 17 + (strong ? 2 : 0);
    }
    y += 12;

    // --- Payments, notes, instructions, terms -------------------------------------------------------------------------
    const section = (title: string, body: string | null | undefined): void => {
      if (!body || !body.trim()) return;
      doc.font('Helvetica').fontSize(9);
      const h = doc.heightOfString(body, { width: CONTENT_W }) + 24;
      if (y + h > BOTTOM) {
        doc.addPage();
        y = M;
      }
      doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(8.5).text(title.toUpperCase(), M, y);
      doc.fillColor(INK).font('Helvetica').fontSize(9).text(body, M, y + 13, { width: CONTENT_W });
      y = doc.y + 12;
    };
    if (v.type === 'INVOICE' && activePayments.length) {
      section('Paiements reçus', activePayments.map((p) => `${fmtDate(p.paidAt)} — ${METHOD_FR[p.method] ?? p.method}${p.reference ? ` (${p.reference})` : ''} : ${formatAmount(p.amount)} ${p.currency}`).join('\n'));
    }
    section('Notes', v.notes);
    section('Instructions de paiement', [v.paymentInstructions, s.bankDetails].filter(Boolean).join('\n'));
    section('Conditions', v.terms);
    if (v.status === 'VOID' && v.voidReason) section('Annulation', v.voidReason);

    // --- Footer, page numbers and watermarks on every page ------------------------------------------------------------
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const saved = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.moveTo(M, PAGE_H - 52).lineTo(PAGE_W - M, PAGE_H - 52).lineWidth(0.5).strokeColor('#DDE5E3').stroke();
      doc.font('Helvetica').fontSize(8).fillColor(GRAY);
      doc.text(s.footerNote ? `${s.footerNote}` : s.legalName, M, PAGE_H - 44, { width: CONTENT_W - 120, lineBreak: false });
      doc.text('Document généré par Impact Pro', M, PAGE_H - 32, { width: CONTENT_W - 120, lineBreak: false });
      doc.text(`${v.number} — Page ${i - range.start + 1}/${range.count}`, PAGE_W - M - 200, PAGE_H - 44, { width: 200, align: 'right', lineBreak: false });
      const mark = v.status === 'VOID' ? 'ANNULÉ' : v.status === 'DRAFT' ? 'BROUILLON' : null;
      if (mark) {
        doc.save();
        doc.rotate(-35, { origin: [PAGE_W / 2, PAGE_H / 2] });
        doc.fillOpacity(0.1).fillColor(v.status === 'VOID' ? '#B91C1C' : GRAY).font('Helvetica-Bold').fontSize(110);
        doc.text(mark, 0, PAGE_H / 2 - 60, { width: PAGE_W, align: 'center', lineBreak: false });
        doc.restore();
      }
      doc.page.margins.bottom = saved;
    }
  }
}
