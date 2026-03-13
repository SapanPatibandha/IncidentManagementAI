import nodemailer from 'nodemailer';
import { env } from '../../config/env';

export class Mailer {
  private transporter: nodemailer.Transporter;
  private defaultTo?: string;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.MAIL_HOST,
      port: env.MAIL_PORT,
      auth: env.MAIL_USER && env.MAIL_PASS ? { user: env.MAIL_USER, pass: env.MAIL_PASS } : undefined,
    });

    this.defaultTo = env.MAIL_TO_OVERRIDE;
  }

  private resolveRecipient(to: string): string {
    return this.defaultTo || to;
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const resolvedTo = this.resolveRecipient(to);

    await this.transporter.sendMail({
      from: 'no-reply@incident-management.ai',
      to: resolvedTo,
      subject,
      html,
    });
  }

  renderTemplate(title: string, message: string, link?: string): string {
    const linkHtml = link ? `<p><a href=\"${link}\">View details</a></p>` : '';
    return `
      <div style="font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <h2>${title}</h2>
        <p>${message}</p>
        ${linkHtml}
        <hr />
        <p style="font-size:12px;color:#6b7280;">This message was sent by Incident Management AI.</p>
      </div>
    `;
  }
}
