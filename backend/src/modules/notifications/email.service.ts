import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log('SMTP Email Transporter configured successfully.');
    } else {
      this.logger.warn('SMTP settings missing in env. Falling back to console mail logger.');
    }
  }

  async sendMail(to: string, subject: string, html: string, text?: string) {
    const from = process.env.SMTP_FROM || 'no-reply@agencyos.com';

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from,
          to,
          subject,
          html,
          text: text || html.replace(/<[^>]*>/g, ''),
        });
        this.logger.log(`Email sent successfully: ${info.messageId}`);
        return info;
      } catch (error) {
        this.logger.error('Failed to send email:', error);
        throw error;
      }
    } else {
      this.logger.log(`[Mock Mail] TO: ${to} | SUBJECT: ${subject} | HTML: ${html.substring(0, 150)}...`);
      return { mock: true, messageId: `mock-${Date.now()}` };
    }
  }
}
