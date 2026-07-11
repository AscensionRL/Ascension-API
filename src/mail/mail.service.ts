import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private transporterChecked = false;

  private isDev(): boolean {
    return (process.env.DEVMODE ?? '').trim().toUpperCase() === 'TRUE';
  }

  private smtpConfig(): {
    host?: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
  } {
    const dev = this.isDev();
    const pick = (devKey: string, prodKey: string): string | undefined =>
      dev ? process.env[devKey] : process.env[prodKey];
    return {
      host: pick('SMTP_DEV_HOST', 'SMTP_HOST'),
      port: Number(pick('SMTP_DEV_PORT', 'SMTP_PORT') ?? 587),
      secure: pick('SMTP_DEV_SECURE', 'SMTP_SECURE') === 'true',
      user: pick('SMTP_DEV_USER', 'SMTP_USER') || undefined,
      pass: pick('SMTP_DEV_PASS', 'SMTP_PASS') || undefined,
    };
  }

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporterChecked) return this.transporter;
    this.transporterChecked = true;
    const cfg = this.smtpConfig();
    if (!cfg.host) {
      this.transporter = null;
      return null;
    }
    this.transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
    return this.transporter;
  }

  private renderTemplate(name: string, vars: Record<string, string>): string {
    let html = readFileSync(join(__dirname, 'templates', name), 'utf8');
    for (const [key, value] of Object.entries(vars)) {
      html = html.split(`{{${key}}}`).join(value);
    }
    return html;
  }

  async sendTwoFactorCode(to: string, username: string, code: string): Promise<void> {
    const html = this.renderTemplate('2fa-code.html', { code, username });
    const from = process.env.SMTP_FROM ?? 'Ascension <no-reply@ascension-dach.org>';
    const transporter = this.getTransporter();

    if (!transporter) {
      this.logger.warn(
        `[Kein SMTP konfiguriert] 2FA-Code für ${to}: ${code} (nur zum Testen im Log)`,
      );
      return;
    }
    await transporter.sendMail({
      from,
      to,
      subject: 'Dein Ascension Login-Code',
      html,
    });
  }
}
