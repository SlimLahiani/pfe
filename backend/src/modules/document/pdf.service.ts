import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PdfService {
  constructor(private readonly prisma: PrismaService) {}
  // ─── Constants ──────────────────────────────────────────────────────────────
  private readonly colors = {
    primary: '#1e1b4b',   // Deep Indigo
    secondary: '#4f46e5', // Royal Blue/Indigo
    accent: '#06b6d4',    // Cyan
    textDark: '#0f172a',  // Dark Slate
    textLight: '#64748b', // Cool Gray
    bgLight: '#f8fafc',    // Off-white/slate-50
    border: '#cbd5e1',     // Slate-300
    divider: '#e2e8f0',    // Slate-200
    success: '#10b981',   // Emerald
  };

  private readonly company = {
    name: 'CREATIVART',
    slogan: 'Agence Digitale & Solutions Logicielles d\'Entreprise',
    address: 'Les Berges du Lac 2, Tunis, 1053, Tunisie',
    phone: '+216 71 888 999',
    email: 'contact@creativart.tn',
    website: 'https://www.creativart.tn',
    taxId: '1234567A/M/000',
    regNumber: 'B01124452024',
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async getQrCodeBuffer(text: string): Promise<Buffer> {
    try {
      return await QRCode.toBuffer(text, {
        margin: 1,
        width: 80,
        color: {
          dark: '#1e1b4b',
          light: '#ffffff'
        }
      });
    } catch {
      // Fallback empty pixel if fails
      return Buffer.from('');
    }
  }

  private drawPremiumHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
    // Elegant accent strip at the top
    doc.rect(0, 0, doc.page.width, 14).fill(this.colors.secondary);

    // Left Column: Logo & Company Info
    const logoPath = path.join(process.cwd(), 'storage', 'logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 20, { height: 45 });
      doc.fillColor(this.colors.secondary).fontSize(7.5).font('Helvetica-Bold').text(this.company.slogan.toUpperCase(), 50, 70);
      doc.fillColor(this.colors.textLight).fontSize(8).font('Helvetica');
      doc.text(`Tél : ${this.company.phone}  |  Email : ${this.company.email}`, 50, 82);
      doc.text(`Adresse : ${this.company.address}`, 50, 94);
    } else {
      doc.fillColor(this.colors.primary).fontSize(24).font('Helvetica-Bold').text(this.company.name, 50, 40);
      doc.fillColor(this.colors.secondary).fontSize(8).font('Helvetica-Bold').text(this.company.slogan.toUpperCase(), 50, 68);
      doc.fillColor(this.colors.textLight).fontSize(8).font('Helvetica');
      doc.text(`Tél : ${this.company.phone}  |  Email : ${this.company.email}`, 50, 80);
      doc.text(`Adresse : ${this.company.address}`, 50, 92);
    }

    // Right Column: Document Type Headline
    const rightX = doc.page.width - 250;
    doc.fillColor(this.colors.primary).fontSize(14).font('Helvetica-Bold').text(title.toUpperCase(), rightX, 40, { align: 'right', width: 200 });
    if (subtitle) {
      doc.fillColor(this.colors.textLight).fontSize(9).font('Helvetica-Oblique').text(subtitle, rightX, 58, { align: 'right', width: 200 });
    }
    doc.fillColor(this.colors.textLight).fontSize(8).font('Helvetica');
    doc.text(`M.F. : ${this.company.taxId} | R.C. : ${this.company.regNumber}`, rightX, 72, { align: 'right', width: 200 });
    doc.text(`Site : ${this.company.website}`, rightX, 84, { align: 'right', width: 200 });

    // Decorative Separator
    doc.strokeColor(this.colors.divider).lineWidth(1.5).moveTo(50, 110).lineTo(doc.page.width - 50, 110).stroke();
  }

  private drawPremiumFooter(doc: PDFKit.PDFDocument, pageNum: number, totalPages: number, docId?: string) {
    const bottomY = doc.page.height - 60;
    doc.strokeColor(this.colors.divider).lineWidth(1).moveTo(50, bottomY).lineTo(doc.page.width - 50, bottomY).stroke();

    doc.fillColor(this.colors.textLight).fontSize(7).font('Helvetica');
    const legalText = `CREATIVART S.A.R.L. au capital social de 100 000 TND. Siège social : ${this.company.address}.\n` +
      `Ce document est généré électroniquement et est légalement contraignant sous réserve des signatures apposées.`;
    doc.text(legalText, 50, bottomY + 10, { width: doc.page.width - 200, align: 'left' });

    doc.text(`Page ${pageNum} sur ${totalPages}`, doc.page.width - 150, bottomY + 10, { width: 100, align: 'right' });
    if (docId) {
      doc.text(`Doc-ID: ${docId.substring(0, 8).toUpperCase()}`, doc.page.width - 150, bottomY + 22, { width: 100, align: 'right' });
    }
  }

  private drawWatermark(doc: PDFKit.PDFDocument) {
    doc.save();
    doc.fillColor(this.colors.primary);
    doc.fillOpacity(0.025);
    doc.fontSize(72).font('Helvetica-Bold');
    doc.translate(doc.page.width / 2, doc.page.height / 2);
    doc.rotate(-45);
    doc.text('CREATIVART', -250, -36, { width: 500, align: 'center' });
    doc.restore();
  }

  private drawSignatureBlock(doc: PDFKit.PDFDocument, x: number, y: number, label: string, subtitle: string, hasStamp = true) {
    doc.save();
    // Signature box
    doc.rect(x, y, 160, 80).strokeColor(this.colors.divider).lineWidth(0.5).stroke();
    
    // Stamp preview box
    if (hasStamp) {
      doc.rect(x + 10, y + 10, 140, 45).fillColor(this.colors.secondary).fillOpacity(0.02).fill();
      doc.fontSize(8).font('Helvetica-Oblique').fillColor(this.colors.secondary).fillOpacity(0.2);
      doc.text('CACHE SIGNATURE NUMÉRIQUE', x + 15, y + 20, { width: 130, align: 'center' });
    }

    doc.fillOpacity(1);
    doc.fillColor(this.colors.primary).fontSize(8).font('Helvetica-Bold').text(label, x + 5, y + 60, { width: 150, align: 'center' });
    doc.fillColor(this.colors.textLight).fontSize(7).font('Helvetica').text(subtitle, x + 5, y + 70, { width: 150, align: 'center' });
    doc.restore();
  }

  private drawDocumentInfoBlock(doc: PDFKit.PDFDocument, x: number, y: number, details: [string, string][]) {
    doc.save();
    doc.rect(x, y, 200, 75).fillColor(this.colors.bgLight).fill();
    doc.rect(x, y, 200, 75).strokeColor(this.colors.divider).lineWidth(1).stroke();

    let textY = y + 8;
    for (const [label, val] of details) {
      doc.fillColor(this.colors.textLight).fontSize(7.5).font('Helvetica-Bold').text(label.toUpperCase(), x + 12, textY);
      doc.fillColor(this.colors.textDark).fontSize(8).font('Helvetica').text(val, x + 90, textY, { width: 100, align: 'right' });
      textY += 13;
    }
    doc.restore();
  }

  // ─── 1. INVOICE ─────────────────────────────────────────────────────────────

  async generateInvoicePdf(invoice: any): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: any) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: any) => reject(err));

        this.drawWatermark(doc);
        this.drawPremiumHeader(doc, 'FACTURE DE VENTE', `Réf: ${invoice.reference}`);

        // Info Block Left: Client Information
        const leftX = 50;
        doc.fillColor(this.colors.secondary).fontSize(9).font('Helvetica-Bold').text('INFORMATIONS CLIENT', leftX, 130);
        doc.fillColor(this.colors.textDark).fontSize(10).font('Helvetica-Bold').text(invoice.client.companyName, leftX, 145);
        
        doc.fillColor(this.colors.textLight).fontSize(8.5).font('Helvetica');
        doc.text(`Adresse : ${invoice.client.address || '—'}`, leftX, 160, { width: 230 });
        if (invoice.client.taxId) {
          doc.text(`Matricule Fiscal : ${invoice.client.taxId}`, leftX, 175);
        }
        
        const primaryContact = invoice.client.contacts?.find((c: any) => c.isPrimary) || invoice.client.contacts?.[0];
        if (primaryContact) {
          doc.text(`À l'attention de : ${primaryContact.firstName} ${primaryContact.lastName}`, leftX, 190);
          doc.text(`Email : ${primaryContact.email} | Tél : ${primaryContact.phone || '—'}`, leftX, 202);
        }

        // Info Block Right: Invoice Metadata Details
        const rightX = doc.page.width - 250;
        const metadata: [string, string][] = [
          ['Facture N°', invoice.reference],
          ['Date Émission', new Date(invoice.issueDate).toLocaleDateString('fr-FR')],
          ['Date Échéance', new Date(invoice.dueDate).toLocaleDateString('fr-FR')],
          ['Mode Paiement', invoice.payments?.[0]?.method || 'Virement Bancaire'],
          ['Statut Facture', invoice.status],
        ];
        this.drawDocumentInfoBlock(doc, rightX, 130, metadata);

        // Services / Articles Table
        const tableTop = 230;
        doc.rect(50, tableTop, doc.page.width - 100, 20).fillColor(this.colors.primary).fill();

        doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
        doc.text('DÉSIGNATION DE PRESTATION', 60, tableTop + 6);
        doc.text('QTÉ', 320, tableTop + 6, { width: 30, align: 'right' });
        doc.text('P.U. HT', 360, tableTop + 6, { width: 65, align: 'right' });
        doc.text('REMISE', 435, tableTop + 6, { width: 50, align: 'right' });
        doc.text('TOTAL HT', 495, tableTop + 6, { width: 45, align: 'right' });

        let currentTop = tableTop + 20;
        doc.font('Helvetica').fontSize(8.5);

        let alternateRow = false;
        for (const item of invoice.items) {
          const rowHeight = 24;
          if (alternateRow) {
            doc.rect(50, currentTop, doc.page.width - 100, rowHeight).fillColor(this.colors.bgLight).fill();
          }
          doc.fillColor(this.colors.textDark);
          doc.text(item.description, 60, currentTop + 8, { width: 250, lineBreak: false });
          doc.text(Number(item.quantity).toFixed(1), 320, currentTop + 8, { width: 30, align: 'right' });
          doc.text(Number(item.unitPrice).toFixed(3), 360, currentTop + 8, { width: 65, align: 'right' });
          doc.text(`${Number(item.discount || 0).toFixed(0)}%`, 435, currentTop + 8, { width: 50, align: 'right' });
          doc.text(Number(item.total).toFixed(3), 495, currentTop + 8, { width: 45, align: 'right' });

          doc.strokeColor(this.colors.divider).lineWidth(0.5).moveTo(50, currentTop + rowHeight).lineTo(doc.page.width - 50, currentTop + rowHeight).stroke();
          currentTop += rowHeight;
          alternateRow = !alternateRow;
        }

        // Summary calculations
        const summaryTop = currentTop + 15;
        const subtotal = Number(invoice.subtotal);
        const taxRate = Number(invoice.taxRate);
        const taxAmount = Number(invoice.taxAmount);
        const total = Number(invoice.total);
        const currency = invoice.currency || 'TND';

        doc.save();
        doc.rect(350, summaryTop, doc.page.width - 400, 80).fillColor(this.colors.bgLight).fill();
        doc.rect(350, summaryTop, doc.page.width - 400, 80).strokeColor(this.colors.divider).lineWidth(0.5).stroke();

        doc.fillColor(this.colors.textLight).fontSize(8).font('Helvetica-Bold');
        doc.text('TOTAL HT', 362, summaryTop + 10);
        doc.text(`TVA (${taxRate}%)`, 362, summaryTop + 25);
        doc.fillColor(this.colors.secondary);
        doc.text('NET À PAYER TTC', 362, summaryTop + 45);

        doc.fillColor(this.colors.textDark).fontSize(8).font('Helvetica');
        doc.text(`${subtotal.toFixed(3)} ${currency}`, doc.page.width - 150, summaryTop + 10, { width: 90, align: 'right' });
        doc.text(`${taxAmount.toFixed(3)} ${currency}`, doc.page.width - 150, summaryTop + 25, { width: 90, align: 'right' });

        doc.fillColor(this.colors.secondary).fontSize(11).font('Helvetica-Bold');
        doc.text(`${total.toFixed(3)} ${currency}`, doc.page.width - 150, summaryTop + 44, { width: 90, align: 'right' });
        doc.restore();

        // Bank Details & Payment Info
        const bankY = summaryTop + 95;
        doc.fillColor(this.colors.secondary).fontSize(8.5).font('Helvetica-Bold').text('INFORMATIONS DE PAIEMENT', 50, bankY);
        doc.fillColor(this.colors.textLight).fontSize(8).font('Helvetica');
        doc.text('Virement bancaire Tunis: BIAT S.A.', 50, bankY + 15);
        doc.text('RIB : 08 047 0001910002030 45', 50, bankY + 27);
        doc.text('Code Swift : BIAT TNTT XXX', 50, bankY + 39);

        // QR Verification Code & Signatures
        const qrY = bankY + 65;
        const verificationUrl = `https://creativart.tn/verify/invoice/${invoice.id}`;
        const qrBuffer = await this.getQrCodeBuffer(verificationUrl);
        if (qrBuffer.length > 0) {
          doc.image(qrBuffer, 50, qrY, { width: 60 });
          doc.fillColor(this.colors.textLight).fontSize(7).font('Helvetica-Oblique');
          doc.text('Scannez pour vérifier l\'authenticité', 50, qrY + 65, { width: 80, align: 'left' });
        }

        // Draw Signature Blocks
        this.drawSignatureBlock(doc, doc.page.width - 380, qrY, 'Cachet CREATIVART', 'Service Finance', true);
        this.drawSignatureBlock(doc, doc.page.width - 210, qrY, 'Signature Client', 'Acceptation Facture', false);

        // Render Page Numbering on all pages
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          this.drawPremiumFooter(doc, i + 1, pages.count, invoice.id);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── 2. QUOTE ───────────────────────────────────────────────────────────────

  async generateQuotePdf(quote: any): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: any) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: any) => reject(err));

        this.drawWatermark(doc);
        this.drawPremiumHeader(doc, 'DEVIS COMMERCIAL', `Réf: ${quote.reference}`);

        // Client info Left
        const leftX = 50;
        doc.fillColor(this.colors.secondary).fontSize(9).font('Helvetica-Bold').text('PROSPECT / CLIENT', leftX, 130);
        doc.fillColor(this.colors.textDark).fontSize(10).font('Helvetica-Bold').text(quote.client.companyName, leftX, 145);
        doc.fillColor(this.colors.textLight).fontSize(8.5).font('Helvetica');
        doc.text(`Adresse : ${quote.client.address || '—'}`, leftX, 160, { width: 230 });
        if (quote.client.taxId) {
          doc.text(`M. Fiscal : ${quote.client.taxId}`, leftX, 175);
        }

        const primaryContact = quote.client.contacts?.find((c: any) => c.isPrimary) || quote.client.contacts?.[0];
        if (primaryContact) {
          doc.text(`Contact : ${primaryContact.firstName} ${primaryContact.lastName}`, leftX, 190);
          doc.text(`Tél : ${primaryContact.phone || '—'} | Email : ${primaryContact.email}`, leftX, 202);
        }

        // Quote Metadata Right
        const rightX = doc.page.width - 250;
        const metadata: [string, string][] = [
          ['Devis N°', quote.reference],
          ['Date Devis', new Date(quote.issueDate).toLocaleDateString('fr-FR')],
          ['Valide Jusqu\'au', new Date(quote.validUntil).toLocaleDateString('fr-FR')],
          ['Statut Devis', quote.status],
        ];
        this.drawDocumentInfoBlock(doc, rightX, 130, metadata);

        // Project brief description if available
        if (quote.projectBrief) {
          doc.fillColor(this.colors.secondary).fontSize(8.5).font('Helvetica-Bold').text('CONTEXTE DU PROJET', leftX, 222);
          doc.fillColor(this.colors.textDark).fontSize(8).font('Helvetica').text(quote.projectBrief, leftX, 235, { width: doc.page.width - 100, align: 'justify' });
        }

        // Table
        const tableTop = quote.projectBrief ? 275 : 230;
        doc.rect(50, tableTop, doc.page.width - 100, 20).fillColor(this.colors.primary).fill();

        doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
        doc.text('DÉTAILS DES SERVICES / PRESTATIONS', 60, tableTop + 6);
        doc.text('QTÉ', 320, tableTop + 6, { width: 30, align: 'right' });
        doc.text('P.U. HT', 360, tableTop + 6, { width: 65, align: 'right' });
        doc.text('REMISE', 435, tableTop + 6, { width: 50, align: 'right' });
        doc.text('TOTAL HT', 495, tableTop + 6, { width: 45, align: 'right' });

        let currentTop = tableTop + 20;
        doc.font('Helvetica').fontSize(8.5);

        let alternateRow = false;
        for (const item of quote.items) {
          const rowHeight = 24;
          if (alternateRow) {
            doc.rect(50, currentTop, doc.page.width - 100, rowHeight).fillColor(this.colors.bgLight).fill();
          }
          doc.fillColor(this.colors.textDark);
          doc.text(item.description, 60, currentTop + 8, { width: 250, lineBreak: false });
          doc.text(Number(item.quantity).toFixed(1), 320, currentTop + 8, { width: 30, align: 'right' });
          doc.text(Number(item.unitPrice).toFixed(3), 360, currentTop + 8, { width: 65, align: 'right' });
          doc.text(`${Number(item.discount || 0).toFixed(0)}%`, 435, currentTop + 8, { width: 50, align: 'right' });
          doc.text(Number(item.total).toFixed(3), 495, currentTop + 8, { width: 45, align: 'right' });

          doc.strokeColor(this.colors.divider).lineWidth(0.5).moveTo(50, currentTop + rowHeight).lineTo(doc.page.width - 50, currentTop + rowHeight).stroke();
          currentTop += rowHeight;
          alternateRow = !alternateRow;
        }

        // Summary
        const summaryTop = currentTop + 15;
        const subtotal = Number(quote.subtotal);
        const taxRate = Number(quote.taxRate);
        const taxAmount = Number(quote.taxAmount);
        const total = Number(quote.total);
        const currency = quote.currency || 'TND';

        doc.save();
        doc.rect(350, summaryTop, doc.page.width - 400, 80).fillColor(this.colors.bgLight).fill();
        doc.rect(350, summaryTop, doc.page.width - 400, 80).strokeColor(this.colors.divider).lineWidth(0.5).stroke();

        doc.fillColor(this.colors.textLight).fontSize(8).font('Helvetica-Bold');
        doc.text('SOUS-TOTAL HT', 362, summaryTop + 10);
        doc.text(`TVA (${taxRate}%)`, 362, summaryTop + 25);
        doc.fillColor(this.colors.secondary);
        doc.text('MONTANT TOTAL TTC', 362, summaryTop + 45);

        doc.fillColor(this.colors.textDark).fontSize(8).font('Helvetica');
        doc.text(`${subtotal.toFixed(3)} ${currency}`, doc.page.width - 150, summaryTop + 10, { width: 90, align: 'right' });
        doc.text(`${taxAmount.toFixed(3)} ${currency}`, doc.page.width - 150, summaryTop + 25, { width: 90, align: 'right' });

        doc.fillColor(this.colors.secondary).fontSize(11).font('Helvetica-Bold');
        doc.text(`${total.toFixed(3)} ${currency}`, doc.page.width - 150, summaryTop + 44, { width: 90, align: 'right' });
        doc.restore();

        // Notes and conditions
        const noteY = summaryTop + 95;
        doc.fillColor(this.colors.secondary).fontSize(8.5).font('Helvetica-Bold').text('CONDITIONS COMMERCIALES & VALIDITÉ', 50, noteY);
        doc.fillColor(this.colors.textLight).fontSize(8).font('Helvetica');
        const conditionsText = quote.notes || `1. Ce devis est valable jusqu'au ${new Date(quote.validUntil).toLocaleDateString('fr-FR')}.\n` +
          `2. Conditions de paiement : 50% à la commande, 50% à la livraison finale.\n` +
          `3. Délai estimé de réalisation : Selon accord mutuel sur le calendrier projet.`;
        doc.text(conditionsText, 50, noteY + 15, { width: doc.page.width - 100, align: 'left' });

        // Signatures & Qr
        const signY = noteY + 70;
        const verificationUrl = `https://creativart.tn/verify/quote/${quote.id}`;
        const qrBuffer = await this.getQrCodeBuffer(verificationUrl);
        if (qrBuffer.length > 0) {
          doc.image(qrBuffer, 50, signY, { width: 60 });
          doc.fillColor(this.colors.textLight).fontSize(7).font('Helvetica-Oblique');
          doc.text('Vérification Authentique', 50, signY + 65, { width: 80, align: 'left' });
        }

        this.drawSignatureBlock(doc, doc.page.width - 380, signY, 'Pour CREATIVART', 'Cachet & Signature', true);
        this.drawSignatureBlock(doc, doc.page.width - 210, signY, 'Bon pour Accord', 'Date, Cachet & Signature Client', false);

        // Render Page Numbering
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          this.drawPremiumFooter(doc, i + 1, pages.count, quote.id);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── 3. EMPLOYMENT CERTIFICATE ──────────────────────────────────────────────

  async generateEmployeeCertificatePdf(employee: any): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: any) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: any) => reject(err));

        this.drawWatermark(doc);
        this.drawPremiumHeader(doc, 'ATTESTATION DE TRAVAIL');

        const employeeName = `${employee.user.firstName} ${employee.user.lastName}`.toUpperCase();
        const code = employee.employeeCode || 'N/A';
        const hireDateStr = employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('fr-FR') : 'N/A';
        const jobTitle = employee.jobTitle || 'N/A';
        const dept = employee.department?.name || 'N/A';
        const nationalId = employee.nationalId || '—';

        // Certificate content
        doc.fillColor(this.colors.primary).fontSize(18).font('Helvetica-Bold').text('ATTESTATION DE TRAVAIL', 50, 160, { align: 'center' });
        doc.strokeColor(this.colors.secondary).lineWidth(1).moveTo(200, 185).lineTo(doc.page.width - 200, 185).stroke();

        const certificateBody = 
          `Nous soussignés, la société CREATIVART, certifions par la présente que :\n\n` +
          `M./Mme ${employeeName}\n` +
          `Titulaire de la Carte d'Identité Nationale N° ${nationalId},\n` +
          `Identifiant interne : ${code},\n\n` +
          `est actuellement employé(e) au sein de notre entreprise en qualité de "${jobTitle}" au sein du département "${dept}" sous contrat de travail à durée indéterminée (CDI).\n\n` +
          `M./Mme ${employeeName} fait partie des effectifs de notre entreprise depuis le ${hireDateStr} et exerce ses fonctions de manière tout à fait satisfaisante.\n\n` +
          `Cette attestation de travail est délivrée à la demande de l'intéressé(e) pour servir et valoir ce que de droit, sans engagement d'aucune sorte de notre part.`;

        doc.fillColor(this.colors.textDark).fontSize(11).font('Helvetica').text(certificateBody, 70, 220, {
          align: 'justify',
          width: doc.page.width - 140,
          lineGap: 7,
        });

        doc.fillColor(this.colors.textLight).fontSize(10).font('Helvetica-Oblique').text(`Fait à Tunis, le ${new Date().toLocaleDateString('fr-FR')}`, 70, 430);

        // Signatures & Qr
        const signY = 470;
        const verificationUrl = `https://creativart.tn/verify/certificate/${employee.id}`;
        const qrBuffer = await this.getQrCodeBuffer(verificationUrl);
        if (qrBuffer.length > 0) {
          doc.image(qrBuffer, 70, signY, { width: 60 });
          doc.fillColor(this.colors.textLight).fontSize(6.5).font('Helvetica-Oblique');
          doc.text('Authentification', 70, signY + 65, { width: 80, align: 'left' });
        }

        this.drawSignatureBlock(doc, doc.page.width - 380, signY, 'Directeur des Ressources Humaines', 'Cachet & Signature RH', true);
        this.drawSignatureBlock(doc, doc.page.width - 210, signY, 'Directeur Général', 'Pour CREATIVART S.A.R.L.', true);

        // Render Page Numbering
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          this.drawPremiumFooter(doc, i + 1, pages.count, employee.id);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── 4. SALARY CERTIFICATE ──────────────────────────────────────────────────

  async generateSalaryCertificatePdf(employee: any, salaryDetails: any): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: any) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: any) => reject(err));

        this.drawWatermark(doc);
        this.drawPremiumHeader(doc, 'ATTESTATION DE SALAIRE');

        const employeeName = `${employee.user.firstName} ${employee.user.lastName}`.toUpperCase();
        const code = employee.employeeCode || 'N/A';
        const hireDateStr = employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('fr-FR') : 'N/A';
        const jobTitle = employee.jobTitle || 'N/A';
        const nationalId = employee.nationalId || '—';
        const grossSalaryVal = Number(salaryDetails?.amount || 0);
        const netSalaryVal = grossSalaryVal * 0.77; // Estimated net
        const currency = salaryDetails?.currency || 'TND';

        doc.fillColor(this.colors.primary).fontSize(18).font('Helvetica-Bold').text('ATTESTATION DE SALAIRE ET DE REVENUS', 50, 160, { align: 'center' });
        doc.strokeColor(this.colors.secondary).lineWidth(1).moveTo(150, 185).lineTo(doc.page.width - 150, 185).stroke();

        const certificateBody = 
          `Nous soussignés, la société CREATIVART, certifions par la présente que M./Mme ${employeeName}, ` +
          `titulaire de la Carte d'Identité Nationale N° ${nationalId}, exerçant au sein de notre entreprise en tant que "${jobTitle}" ` +
          `depuis le ${hireDateStr}, perçoit les rémunérations régulières détaillées ci-après :\n\n`;

        doc.fillColor(this.colors.textDark).fontSize(11).font('Helvetica').text(certificateBody, 70, 220, {
          align: 'justify',
          width: doc.page.width - 140,
          lineGap: 6,
        });

        // Detailed Salary Table Box
        const boxY = 285;
        doc.rect(70, boxY, doc.page.width - 140, 95).fillColor(this.colors.bgLight).fill();
        doc.rect(70, boxY, doc.page.width - 140, 95).strokeColor(this.colors.divider).lineWidth(1).stroke();

        doc.fillColor(this.colors.textLight).fontSize(9).font('Helvetica-Bold');
        doc.text('RUBRIQUE DE SALAIRE', 85, boxY + 12);
        doc.text('MONTANT MENSUEL HT', doc.page.width - 250, boxY + 12, { width: 160, align: 'right' });

        doc.strokeColor(this.colors.divider).lineWidth(0.5).moveTo(70, boxY + 28).lineTo(doc.page.width - 70, boxY + 28).stroke();

        doc.fillColor(this.colors.textDark).fontSize(9.5).font('Helvetica');
        doc.text('Salaire Mensuel Brut Fixe', 85, boxY + 38);
        doc.text(`${grossSalaryVal.toFixed(3)} ${currency}`, doc.page.width - 250, boxY + 38, { width: 160, align: 'right' });

        doc.text('Avantages et Primes Contractuels', 85, boxY + 54);
        doc.save();
        doc.font('Helvetica-Oblique');
        doc.text(`Inclus dans la rémunération globale`, doc.page.width - 250, boxY + 54, { width: 160, align: 'right' });
        doc.restore();

        doc.strokeColor(this.colors.divider).lineWidth(0.5).moveTo(70, boxY + 70).lineTo(doc.page.width - 70, boxY + 70).stroke();

        doc.fillColor(this.colors.secondary).fontSize(10.5).font('Helvetica-Bold');
        doc.text('Estimation du Salaire Net Mensuel', 85, boxY + 78);
        doc.text(`${netSalaryVal.toFixed(3)} ${currency}`, doc.page.width - 250, boxY + 78, { width: 160, align: 'right' });

        const endText = `Cette attestation est délivrée à l'intéressé(e) pour servir auprès des institutions financières et bancaires de la place Tunisienne, pour faire valoir ce que de droit.`;
        doc.fillColor(this.colors.textDark).fontSize(11).font('Helvetica').text(endText, 70, 400, {
          align: 'justify',
          width: doc.page.width - 140,
          lineGap: 6,
        });

        doc.fillColor(this.colors.textLight).fontSize(10).font('Helvetica-Oblique').text(`Fait à Tunis, le ${new Date().toLocaleDateString('fr-FR')}`, 70, 455);

        // Signatures & Qr
        const signY = 485;
        const verificationUrl = `https://creativart.tn/verify/salary/${employee.id}`;
        const qrBuffer = await this.getQrCodeBuffer(verificationUrl);
        if (qrBuffer.length > 0) {
          doc.image(qrBuffer, 70, signY, { width: 60 });
          doc.fillColor(this.colors.textLight).fontSize(6.5).font('Helvetica-Oblique');
          doc.text('Vérifier ce document', 70, signY + 65, { width: 80, align: 'left' });
        }

        this.drawSignatureBlock(doc, doc.page.width - 380, signY, 'Directeur des Ressources Humaines', 'Cachet & Signature RH', true);
        this.drawSignatureBlock(doc, doc.page.width - 210, signY, 'Directeur Général', 'Pour CREATIVART S.A.R.L.', true);

        // Render Page Numbering
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          this.drawPremiumFooter(doc, i + 1, pages.count, employee.id);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── 5. EMPLOYMENT CONTRACT ─────────────────────────────────────────────────

  async generateEmploymentContractPdf(employee: any, contract: any): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: any) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: any) => reject(err));

        this.drawWatermark(doc);

        // ─── COVER PAGE ───
        doc.rect(0, 0, doc.page.width, 25).fill(this.colors.primary);
        doc.rect(0, doc.page.height - 25, doc.page.width, 25).fill(this.colors.primary);

        doc.fillColor(this.colors.primary).fontSize(28).font('Helvetica-Bold').text(this.company.name, 70, 180);
        doc.fillColor(this.colors.secondary).fontSize(11).font('Helvetica-Bold').text(this.company.slogan.toUpperCase(), 70, 215);

        doc.strokeColor(this.colors.secondary).lineWidth(2.5).moveTo(70, 240).lineTo(doc.page.width - 150, 240).stroke();

        doc.fillColor(this.colors.textDark).fontSize(20).font('Helvetica-Bold').text('CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE', 70, 270);
        doc.fillColor(this.colors.textLight).fontSize(10).font('Helvetica').text(`Référence Contrat: CONTRACT-${contract.id.substring(0, 8).toUpperCase()}`, 70, 300);

        // Card Box on Cover
        const cardY = 360;
        doc.rect(70, cardY, doc.page.width - 140, 110).fillColor(this.colors.bgLight).fill();
        doc.rect(70, cardY, doc.page.width - 140, 110).strokeColor(this.colors.divider).lineWidth(1).stroke();

        doc.fillColor(this.colors.textLight).fontSize(9).font('Helvetica-Bold').text('COLLABORATEUR RECRUTÉ', 90, cardY + 18);
        doc.fillColor(this.colors.textDark).fontSize(12).font('Helvetica-Bold').text(`${employee.user.firstName} ${employee.user.lastName}`.toUpperCase(), 90, cardY + 34);
        
        doc.fillColor(this.colors.textLight).fontSize(9).font('Helvetica');
        doc.text(`Poste Assigné : ${employee.jobTitle || 'Collaborateur'}`, 90, cardY + 58);
        doc.text(`Département : ${employee.department?.name || 'Développement & Ingénierie'}`, 90, cardY + 74);
        doc.text(`Date d'effet : ${new Date(contract.startDate).toLocaleDateString('fr-FR')}`, 90, cardY + 90);

        doc.fillColor(this.colors.textLight).fontSize(8.5).font('Helvetica-Oblique').text('Édité par le Département RH CreativArt', 70, doc.page.height - 80);

        // ─── PAGE 2: ARTICLES ───
        doc.addPage();
        this.drawWatermark(doc);
        this.drawPremiumHeader(doc, 'CONTRAT DE TRAVAIL', 'Articles Légaux & Accord');

        const employeeName = `${employee.user.firstName} ${employee.user.lastName}`.toUpperCase();
        const nationalId = employee.nationalId || '—';
        const startStr = new Date(contract.startDate).toLocaleDateString('fr-FR');
        const grossSalaryVal = Number(contract.grossSalary).toFixed(3);
        const currency = contract.currency || 'TND';

        const contractBody = 
          `IL A ÉTÉ CONVENU CE QUI SUIT :\n\n` +
          `Entre les soussignés : La société CREATIVART S.A.R.L., sise aux Berges du Lac 2, Tunis, représentée par son Directeur Général (dénommée l'Employeur d'une part),\n` +
          `Et M./Mme ${employeeName}, de nationalité Tunisienne, titulaire de la C.I.N. N° ${nationalId} (dénommé(e) le Salarié d'autre part).\n\n` +
          `Article 1 - Nature & Durée de l'Engagement\n` +
          `Le Salarié est recruté en tant que "${employee.jobTitle || 'Collaborateur'}" sous contrat à durée indéterminée (CDI) à temps plein. Le présent contrat prend effet à compter du ${startStr}.\n\n` +
          `Article 2 - Fonctions & Responsabilités\n` +
          `Le Salarié exécutera ses tâches avec diligence et intégrité. Les tâches de base incluent le développement, la consultation et la livraison de projets clients ainsi que l'assistance aux équipes d'AgencyOS.\n\n` +
          `Article 3 - Rémunération Mensuelle\n` +
          `En contrepartie, le Salarié percevra un salaire mensuel brut global contractuel de ${grossSalaryVal} ${currency}, payable en fin de mois.\n\n` +
          `Article 4 - Confidentialité & Clause de Non-Concurrence\n` +
          `Le Salarié s'engage à observer la plus stricte confidentialité concernant les secrets technologiques, logiciels, et clients de CREATIVART, tant durant le contrat qu'après sa résiliation.`;

        doc.fillColor(this.colors.textDark).fontSize(9.5).font('Helvetica').text(contractBody, 60, 130, {
          align: 'justify',
          width: doc.page.width - 120,
          lineGap: 5,
        });

        // Signatures Page Block
        const signY = 480;
        const verificationUrl = `https://creativart.tn/verify/contract/${contract.id}`;
        const qrBuffer = await this.getQrCodeBuffer(verificationUrl);
        if (qrBuffer.length > 0) {
          doc.image(qrBuffer, 60, signY, { width: 60 });
          doc.fillColor(this.colors.textLight).fontSize(6).font('Helvetica-Oblique');
          doc.text('Vérification Contrat', 60, signY + 65, { width: 80, align: 'left' });
        }

        this.drawSignatureBlock(doc, doc.page.width - 380, signY, 'Le Salarié', 'Lu et approuvé', false);
        this.drawSignatureBlock(doc, doc.page.width - 210, signY, 'Pour CREATIVART', 'Direction Générale', true);

        // Render Page Numbering on all pages
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          this.drawPremiumFooter(doc, i + 1, pages.count, contract.id);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── 6. INTERNSHIP CERTIFICATE ──────────────────────────────────────────────

  async generateInternshipCertificatePdf(employee: any): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: any) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: any) => reject(err));

        this.drawWatermark(doc);
        this.drawPremiumHeader(doc, 'ATTESTATION DE STAGE');

        const employeeName = `${employee.user.firstName} ${employee.user.lastName}`.toUpperCase();
        const code = employee.employeeCode || 'N/A';
        const hireDateStr = employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('fr-FR') : 'N/A';
        const jobTitle = employee.jobTitle || 'Stagiaire';
        const dept = employee.department?.name || 'Ingénierie & Design';
        const nationalId = employee.nationalId || '—';

        doc.fillColor(this.colors.primary).fontSize(18).font('Helvetica-Bold').text('ATTESTATION DE FIN DE STAGE', 50, 160, { align: 'center' });
        doc.strokeColor(this.colors.secondary).lineWidth(1).moveTo(200, 185).lineTo(doc.page.width - 200, 185).stroke();

        const certificateBody = 
          `Nous soussignés, la société CREATIVART, certifions par la présente que :\n\n` +
          `M./Mme ${employeeName}\n` +
          `Titulaire de la Carte d'Identité Nationale N° ${nationalId},\n` +
          `Identifiant de Stage : ${code},\n\n` +
          `a effectué un stage professionnel pratique au sein de notre agence dans le département "${dept}" en qualité de "${jobTitle}".\n\n` +
          `Le stage s'est déroulé à partir du ${hireDateStr} pour une durée réglementaire conventionnelle.\n\n` +
          `Durant cette période, le/la stagiaire a fait preuve d'esprit d'initiative, de curiosité intellectuelle et d'adaptation aux méthodologies de développement de l'agence. Son projet a été soutenu avec succès.\n\n` +
          `Cette attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.`;

        doc.fillColor(this.colors.textDark).fontSize(11).font('Helvetica').text(certificateBody, 70, 220, {
          align: 'justify',
          width: doc.page.width - 140,
          lineGap: 7,
        });

        doc.fillColor(this.colors.textLight).fontSize(10).font('Helvetica-Oblique').text(`Fait à Tunis, le ${new Date().toLocaleDateString('fr-FR')}`, 70, 440);

        // Signatures & Qr
        const signY = 475;
        const verificationUrl = `https://creativart.tn/verify/internship/${employee.id}`;
        const qrBuffer = await this.getQrCodeBuffer(verificationUrl);
        if (qrBuffer.length > 0) {
          doc.image(qrBuffer, 70, signY, { width: 60 });
          doc.fillColor(this.colors.textLight).fontSize(6.5).font('Helvetica-Oblique');
          doc.text('Authentification', 70, signY + 65, { width: 80, align: 'left' });
        }

        this.drawSignatureBlock(doc, doc.page.width - 380, signY, 'Directeur de Stage / Encadrant', 'Signature Mentorat', true);
        this.drawSignatureBlock(doc, doc.page.width - 210, signY, 'Directeur Général', 'Pour CREATIVART S.A.R.L.', true);

        // Render Page Numbering
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          this.drawPremiumFooter(doc, i + 1, pages.count, employee.id);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── 7. PAYSLIP ─────────────────────────────────────────────────────────────

  async generatePayslipPdf(payslip: any, employee: any): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: any) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: any) => reject(err));

        this.drawWatermark(doc);
        this.drawPremiumHeader(doc, 'BULLETIN DE PAIE MENSUEL');

        // Metadata left
        const leftX = 50;
        doc.fillColor(this.colors.secondary).fontSize(9).font('Helvetica-Bold').text('INFORMATIONS SALARIÉ', leftX, 130);
        doc.fillColor(this.colors.textDark).fontSize(10).font('Helvetica-Bold').text(`${employee.user.firstName} ${employee.user.lastName}`.toUpperCase(), leftX, 145);
        
        doc.fillColor(this.colors.textLight).fontSize(8.5).font('Helvetica');
        doc.text(`Matricule Salarié : ${employee.employeeCode || '—'}`, leftX, 160);
        doc.text(`Poste Occupé : ${employee.jobTitle || '—'}`, leftX, 172);
        if (employee.department) {
          doc.text(`Département : ${employee.department.name}`, leftX, 184);
        }

        // Period & Payslip info right
        const rightX = doc.page.width - 250;
        const metadata: [string, string][] = [
          ['Période Paie', `${payslip.month}/${payslip.year}`],
          ['Date Paiement', new Date().toLocaleDateString('fr-FR')],
          ['Référence Paie', `PAY-${payslip.id.substring(0, 8).toUpperCase()}`],
          ['Mode Virement', 'Virement Bancaire BIAT'],
        ];
        this.drawDocumentInfoBlock(doc, rightX, 130, metadata);

        // Payslip items breakdown table
        const tableTop = 210;
        doc.rect(50, tableTop, doc.page.width - 100, 20).fillColor(this.colors.primary).fill();

        doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
        doc.text('RUBRIQUES ET DÉTAILS DE RÉMUNÉRATION', 60, tableTop + 6);
        doc.text('MONTANT BRUT (TND)', doc.page.width - 200, tableTop + 6, { width: 140, align: 'right' });

        doc.strokeColor(this.colors.border).lineWidth(0.5).moveTo(50, tableTop + 20).lineTo(doc.page.width - 50, tableTop + 20).stroke();

        doc.font('Helvetica').fontSize(8.5).fillColor(this.colors.textDark);
        let currentTop = tableTop + 20;

        const items = [
          { label: 'Salaire de Base Fixe Contractuel', val: Number(payslip.baseSalary) },
          { label: 'Heures Supplémentaires Réalisées', val: Number(payslip.overtime) },
          { label: 'Primes Contractuelles & Avantages', val: Number(payslip.bonuses) },
          { label: 'Retenues Sociales & Cotisations (Déductions)', val: -Number(payslip.deductions) },
        ];

        let alternate = false;
        for (const item of items) {
          const rowHeight = 24;
          if (alternate) {
            doc.rect(50, currentTop, doc.page.width - 100, rowHeight).fillColor(this.colors.bgLight).fill();
          }
          doc.fillColor(this.colors.textDark);
          doc.text(item.label, 60, currentTop + 8);
          doc.text(`${item.val.toFixed(3)} TND`, doc.page.width - 200, currentTop + 8, { width: 140, align: 'right' });

          doc.strokeColor(this.colors.divider).lineWidth(0.5).moveTo(50, currentTop + rowHeight).lineTo(doc.page.width - 50, currentTop + rowHeight).stroke();
          currentTop += rowHeight;
          alternate = !alternate;
        }

        // Summary Net à Payer
        const summaryTop = currentTop + 15;
        doc.save();
        doc.rect(300, summaryTop, doc.page.width - 350, 45).fillColor(this.colors.bgLight).fill();
        doc.rect(300, summaryTop, doc.page.width - 350, 45).strokeColor(this.colors.divider).lineWidth(1).stroke();

        doc.fillColor(this.colors.secondary).fontSize(10).font('Helvetica-Bold');
        doc.text('NET NET À PAYER PAR VIREMENT', 312, summaryTop + 17);
        doc.text(`${Number(payslip.netSalary).toFixed(3)} TND`, doc.page.width - 190, summaryTop + 17, { width: 130, align: 'right' });
        doc.restore();

        // Signatures & Qr
        const signY = summaryTop + 75;
        const verificationUrl = `https://creativart.tn/verify/payslip/${payslip.id}`;
        const qrBuffer = await this.getQrCodeBuffer(verificationUrl);
        if (qrBuffer.length > 0) {
          doc.image(qrBuffer, 50, signY, { width: 60 });
          doc.fillColor(this.colors.textLight).fontSize(6.5).font('Helvetica-Oblique');
          doc.text('Vérification Paie', 50, signY + 65, { width: 80, align: 'left' });
        }

        this.drawSignatureBlock(doc, doc.page.width - 380, signY, 'Directeur des Ressources Humaines', 'Cachet & Signature RH', true);
        this.drawSignatureBlock(doc, doc.page.width - 210, signY, 'Le Salarié', 'Reçu pour Information', false);

        // Render Page Numbering
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          this.drawPremiumFooter(doc, i + 1, pages.count, payslip.id);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── 8. LEAVE APPROVAL ──────────────────────────────────────────────────────

  async generateLeaveApprovalPdf(leaveRequest: any): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: any) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: any) => reject(err));

        this.drawWatermark(doc);
        this.drawPremiumHeader(doc, 'APPROBATION DE CONGÉ ABSENCES');

        const employeeName = `${leaveRequest.employee.user.firstName} ${leaveRequest.employee.user.lastName}`.toUpperCase();
        const code = leaveRequest.employee.employeeCode || 'N/A';
        const startDateStr = new Date(leaveRequest.startDate).toLocaleDateString('fr-FR');
        const endDateStr = new Date(leaveRequest.endDate).toLocaleDateString('fr-FR');
        const totalDays = leaveRequest.days;
        const type = leaveRequest.type;
        const status = leaveRequest.status;
        const reason = leaveRequest.reason || 'Non spécifié';

        doc.fillColor(this.colors.primary).fontSize(16).font('Helvetica-Bold').text('CERTIFICAT D\'AUTORISATION D\'ABSENCE ET DE CONGÉ', 50, 160, { align: 'center' });
        doc.strokeColor(this.colors.secondary).lineWidth(1).moveTo(100, 185).lineTo(doc.page.width - 100, 185).stroke();

        const certificateBody = 
          `Nous soussignés, la direction des Ressources Humaines de la société CREATIVART, certifions par la présente que la demande d'absence et de congé déposée par :\n\n` +
          `M./Mme ${employeeName}\n` +
          `Identifiant de Salarié : ${code},\n\n` +
          `a été officiellement examinée, validée et approuvée par le responsable hiérarchique concerné aux conditions précisées ci-dessous :`;

        doc.fillColor(this.colors.textDark).fontSize(11).font('Helvetica').text(certificateBody, 70, 210, {
          align: 'justify',
          width: doc.page.width - 140,
          lineGap: 6,
        });

        // Detail block info
        const blockY = 320;
        doc.rect(70, blockY, doc.page.width - 140, 100).fillColor(this.colors.bgLight).fill();
        doc.rect(70, blockY, doc.page.width - 140, 100).strokeColor(this.colors.divider).lineWidth(1).stroke();

        const detailRows = [
          ['Type de Congé', type],
          ['Date de Début', startDateStr],
          ['Date de Retour', endDateStr],
          ['Nombre de Jours Ouvrés', `${totalDays} Jour(s)`],
          ['Statut Approbation', status],
        ];

        let detailY = blockY + 12;
        for (const [l, v] of detailRows) {
          doc.fillColor(this.colors.textLight).fontSize(8.5).font('Helvetica-Bold').text(l, 85, detailY);
          doc.fillColor(this.colors.textDark).fontSize(9).font('Helvetica').text(v, doc.page.width - 250, detailY, { width: 160, align: 'right' });
          detailY += 16;
        }

        doc.fillColor(this.colors.textLight).fontSize(10).font('Helvetica-Oblique').text(`Fait à Tunis, le ${new Date().toLocaleDateString('fr-FR')}`, 70, 445);

        // Signatures & Qr
        const signY = 475;
        const verificationUrl = `https://creativart.tn/verify/leave/${leaveRequest.id}`;
        const qrBuffer = await this.getQrCodeBuffer(verificationUrl);
        if (qrBuffer.length > 0) {
          doc.image(qrBuffer, 70, signY, { width: 60 });
          doc.fillColor(this.colors.textLight).fontSize(6.5).font('Helvetica-Oblique');
          doc.text('Authenticité', 70, signY + 65, { width: 80, align: 'left' });
        }

        this.drawSignatureBlock(doc, doc.page.width - 380, signY, 'Le Responsable de Validation', 'Validation Managériale', true);
        this.drawSignatureBlock(doc, doc.page.width - 210, signY, 'Direction des RH', 'CREATIVART Ressources Humaines', true);

        // Render Page Numbering
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          this.drawPremiumFooter(doc, i + 1, pages.count, leaveRequest.id);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── Legacy/Sample ──────────────────────────────────────────────────────────

  async generateSampleDocument(title: string, author: string, content: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: any) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: any) => reject(err));

      this.drawWatermark(doc);
      this.drawPremiumHeader(doc, 'RAPPORT D\'AUDIT SYSTÈME');
      
      doc.fillColor('#0f172a').fontSize(18).font('Helvetica-Bold').text(title, 50, 130);
      doc.fillColor('#64748b').fontSize(10).font('Helvetica').text(`Auteur: ${author}`, 50, 155);
      doc.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`, 50, 170);
      
      doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, 190).lineTo(doc.page.width - 50, 190).stroke();

      doc.fillColor('#334155').fontSize(12).font('Helvetica').text(content, 50, 210, {
        align: 'justify',
        width: doc.page.width - 100,
        lineGap: 4,
      });

      this.drawPremiumFooter(doc, 1, 1);
      doc.end();
    });
  }

  async archiveDocument(
    pdfBuffer: Buffer,
    originalFileName: string,
    entityType: string,
    entityId: string,
    clientId?: string,
    createdById?: string,
  ): Promise<any> {
    const storedFileName = `${randomUUID()}.pdf`;
    const dir = path.join(process.cwd(), 'storage', 'documents');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, storedFileName);
    fs.writeFileSync(filePath, pdfBuffer);

    const downloadUrl = `/documents/${storedFileName}/download`;
    
    // Check if a document record already exists for this entity to prevent duplicate records
    const existingDoc = await this.prisma.document.findFirst({
      where: { entityType, entityId },
    });

    if (existingDoc) {
      // Delete old file if exists
      try {
        if (fs.existsSync(existingDoc.path)) {
          fs.unlinkSync(existingDoc.path);
        }
      } catch (err) {
        console.warn('Failed to delete old document file:', err);
      }

      return this.prisma.document.update({
        where: { id: existingDoc.id },
        data: {
          originalFileName,
          storedFileName,
          path: filePath,
          url: downloadUrl,
          size: pdfBuffer.length,
        },
      });
    }

    return this.prisma.document.create({
      data: {
        originalFileName,
        storedFileName,
        mimeType: 'application/pdf',
        path: filePath,
        entityType,
        entityId,
        clientId,
        uploadedById: createdById,
        title: originalFileName,
        url: downloadUrl,
        size: pdfBuffer.length,
        isArchived: true,
      },
    });
  }

  async generateAndArchiveInvoicePdf(invoice: any): Promise<any> {
    const originalFileName = `FACTURE-${invoice.reference}.pdf`;
    const pdfBuffer = await this.generateInvoicePdf(invoice);
    const document = await this.archiveDocument(
      pdfBuffer,
      originalFileName,
      'INVOICE',
      invoice.id,
      invoice.clientId,
      invoice.createdById,
    );
    return { filePath: document.path, document };
  }

  async generateAndArchiveQuotePdf(quote: any): Promise<any> {
    const originalFileName = `DEVIS-${quote.reference}.pdf`;
    const pdfBuffer = await this.generateQuotePdf(quote);
    const document = await this.archiveDocument(
      pdfBuffer,
      originalFileName,
      'QUOTE',
      quote.id,
      quote.clientId,
      quote.createdById,
    );
    return { filePath: document.path, document };
  }
}
