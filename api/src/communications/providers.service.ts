import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Outbound channels. Providers are chosen by environment:
 *  SMS_PROVIDER = LOG | ARKESEL      EMAIL_PROVIDER = LOG | SMTP
 * LOG writes to the server log so every flow works in development without credentials.
 */
@Injectable()
export class ProvidersService {
  private readonly logger = new Logger('Messaging');
  private transporter: nodemailer.Transporter | null = null;

  private smtp() {
    if (this.transporter) return this.transporter;
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    return this.transporter;
  }

  async sendSms(to: string[], message: string, senderId?: string): Promise<{ sent: number; provider: string }> {
    const recipients = [...new Set(to.map((p) => p.replace(/\s+/g, '')).filter((p) => /^\+?\d{9,15}$/.test(p)))];
    if (!recipients.length) return { sent: 0, provider: 'NONE' };
    const provider = (process.env.SMS_PROVIDER || 'LOG').toUpperCase();
    if (provider === 'ARKESEL' && process.env.SMS_API_KEY) {
      try {
        const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
          method: 'POST',
          headers: { 'api-key': process.env.SMS_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: senderId || process.env.SMS_SENDER_ID || 'SchoolOS', message, recipients }),
        });
        const json: any = await res.json().catch(() => ({}));
        if (!res.ok || (json.status && json.status !== 'success'))
          throw new Error(json.message ?? `HTTP ${res.status}`);
        return { sent: recipients.length, provider };
      } catch (e) {
        this.logger.error(`SMS send failed: ${(e as Error).message}`);
        return { sent: 0, provider };
      }
    }
    this.logger.log(`[SMS:LOG] to ${recipients.length} recipient(s): "${message.slice(0, 120)}"`);
    return { sent: recipients.length, provider: 'LOG' };
  }

  async sendEmail(
    to: string[],
    subject: string,
    text: string,
    html?: string,
  ): Promise<{ sent: number; provider: string }> {
    const recipients = [...new Set(to.filter((e) => /\S+@\S+\.\S+/.test(e)))];
    if (!recipients.length) return { sent: 0, provider: 'NONE' };
    const provider = (process.env.EMAIL_PROVIDER || 'LOG').toUpperCase();
    if (provider === 'SMTP' && process.env.SMTP_HOST) {
      try {
        await this.smtp().sendMail({
          from: process.env.EMAIL_FROM || 'Nimdee <no-reply@schoolos.app>',
          bcc: recipients,
          subject,
          text,
          html: html ?? `<p>${text.replace(/\n/g, '<br/>')}</p>`,
        });
        return { sent: recipients.length, provider };
      } catch (e) {
        this.logger.error(`Email send failed: ${(e as Error).message}`);
        return { sent: 0, provider };
      }
    }
    this.logger.log(`[EMAIL:LOG] "${subject}" to ${recipients.length} recipient(s)`);
    return { sent: recipients.length, provider: 'LOG' };
  }
}
