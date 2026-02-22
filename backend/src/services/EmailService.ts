// Email Service with SMTP and DKIM support
// Handles email verification, password reset, and subscription reminders

import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import config from '../utils/config';
import logger from '../utils/logger';
import { DatabaseFactory } from '../models/DatabaseFactory';

export enum EmailType {
  VERIFICATION = 'verification',
  PASSWORD_RESET = 'password_reset',
  SUBSCRIPTION_EXPIRY_REMINDER = 'subscription_expiry_reminder',
  SUBSCRIPTION_EXPIRED = 'subscription_expired',
  WELCOME = 'welcome',
  ACCOUNT_SUSPENDED = 'account_suspended'
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface VerificationTokenResult {
  token: string;
  expiresAt: Date;
}

class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter | null = null;
  private database: any;
  private isConfigured: boolean = false;

  private constructor() {
    this.database = DatabaseFactory.getDatabase();
    this.initializeTransporter();
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private initializeTransporter(): void {
    const { smtp, dkim } = config.communication.email;

    if (!smtp.user || !smtp.password) {
      logger.warn('📧 Email service not configured - SMTP credentials missing');
      this.isConfigured = false;
      return;
    }

    const transportOptions: any = {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.password
      }
    };

    // Add DKIM signing if private key is provided
    if (dkim.privateKey) {
      transportOptions.dkim = {
        domainName: dkim.domainName,
        keySelector: dkim.keySelector,
        privateKey: dkim.privateKey.replace(/\\n/g, '\n') // Handle escaped newlines from env
      };
      logger.info('📧 DKIM signing enabled for domain:', dkim.domainName);
    }

    this.transporter = nodemailer.createTransport(transportOptions);
    this.isConfigured = true;
    
    // Verify connection
    this.transporter.verify((error) => {
      if (error) {
        logger.error('📧 Email transporter verification failed:', error);
        this.isConfigured = false;
      } else {
        logger.info('📧 Email service initialized successfully');
      }
    });
  }

  /**
   * Send an email
   */
  public async sendEmail(options: EmailOptions, userId?: string, emailType?: EmailType): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      logger.error('📧 Email service not configured');
      return false;
    }

    const { smtp } = config.communication.email;
    const emailLogId = uuidv4();

    try {
      // Log email attempt
      await this.logEmail(emailLogId, userId || null, options.to, emailType || 'custom', options.subject, 'pending');

      const mailOptions = {
        from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      // Update log with success
      await this.updateEmailLog(emailLogId, 'sent');

      logger.info('📧 Email sent successfully', {
        messageId: info.messageId,
        to: options.to,
        subject: options.subject,
        type: emailType
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update log with failure
      await this.updateEmailLog(emailLogId, 'failed', errorMessage);

      logger.error('📧 Failed to send email', {
        to: options.to,
        subject: options.subject,
        error: errorMessage
      });

      return false;
    }
  }

  /**
   * Create email verification token
   */
  public async createVerificationToken(userId: string, ipAddress?: string): Promise<VerificationTokenResult> {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + config.communication.email.verification.tokenExpiryHours * 60 * 60 * 1000);
    const id = uuidv4();

    await this.database.query(
      `INSERT INTO email_verification_tokens (id, user_id, token, expires_at, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, userId, token, expiresAt, ipAddress || null]
    );

    logger.info('📧 Email verification token created', { userId });

    return { token, expiresAt };
  }

  /**
   * Validate email verification token
   */
  public async validateVerificationToken(token: string): Promise<{ userId: string } | null> {
    const result = await this.database.query(
      `SELECT user_id FROM email_verification_tokens 
       WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`,
      [token]
    );

    if (!result || result.length === 0) {
      return null;
    }

    return { userId: result[0].user_id };
  }

  /**
   * Mark verification token as used
   */
  public async markVerificationTokenUsed(token: string): Promise<void> {
    await this.database.query(
      `UPDATE email_verification_tokens SET used_at = NOW() WHERE token = $1`,
      [token]
    );
  }

  /**
   * Create password reset token
   */
  public async createPasswordResetToken(userId: string, ipAddress?: string): Promise<VerificationTokenResult> {
    // Invalidate existing tokens for this user
    await this.database.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    );

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + config.communication.email.passwordReset.tokenExpiryHours * 60 * 60 * 1000);
    const id = uuidv4();

    await this.database.query(
      `INSERT INTO password_reset_tokens (id, user_id, token, expires_at, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, userId, token, expiresAt, ipAddress || null]
    );

    logger.info('📧 Password reset token created', { userId });

    return { token, expiresAt };
  }

  /**
   * Validate password reset token
   */
  public async validatePasswordResetToken(token: string): Promise<{ userId: string } | null> {
    const result = await this.database.query(
      `SELECT user_id FROM password_reset_tokens 
       WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`,
      [token]
    );

    if (!result || result.length === 0) {
      return null;
    }

    return { userId: result[0].user_id };
  }

  /**
   * Mark password reset token as used
   */
  public async markPasswordResetTokenUsed(token: string): Promise<void> {
    await this.database.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE token = $1`,
      [token]
    );
  }

  /**
   * Send verification email
   */
  public async sendVerificationEmail(
    email: string,
    firstName: string,
    token: string,
    userId: string
  ): Promise<boolean> {
    const verificationUrl = `${config.communication.email.verification.baseUrl}/verify-email?token=${token}`;

    const html = this.getVerificationEmailTemplate(firstName, verificationUrl);

    return this.sendEmail(
      {
        to: email,
        subject: '🔐 Потвърдете вашия имейл адрес - SnapFix',
        html
      },
      userId,
      EmailType.VERIFICATION
    );
  }

  /**
   * Send password reset email
   */
  public async sendPasswordResetEmail(
    email: string,
    firstName: string,
    token: string,
    userId: string
  ): Promise<boolean> {
    const resetUrl = `${config.communication.email.passwordReset.baseUrl}/auth/reset-password?token=${token}`;

    const html = this.getPasswordResetEmailTemplate(firstName, resetUrl);

    return this.sendEmail(
      {
        to: email,
        subject: '🔑 Възстановяване на парола - SnapFix',
        html
      },
      userId,
      EmailType.PASSWORD_RESET
    );
  }

  /**
   * Send welcome email after successful registration
   */
  public async sendWelcomeEmail(
    email: string,
    firstName: string,
    role: string,
    userId: string
  ): Promise<boolean> {
    const html = this.getWelcomeEmailTemplate(firstName, role);

    return this.sendEmail(
      {
        to: email,
        subject: '🎉 Добре дошли в SnapFix!',
        html
      },
      userId,
      EmailType.WELCOME
    );
  }

  /**
   * Send subscription expiry reminder
   */
  public async sendSubscriptionExpiryReminder(
    email: string,
    firstName: string,
    daysRemaining: number,
    subscriptionTier: string,
    expiryDate: Date,
    userId: string
  ): Promise<boolean> {
    const html = this.getSubscriptionExpiryReminderTemplate(firstName, daysRemaining, subscriptionTier, expiryDate);

    return this.sendEmail(
      {
        to: email,
        subject: `⏰ Вашият ${subscriptionTier} абонамент изтича след ${daysRemaining} ${daysRemaining === 1 ? 'ден' : 'дни'} - SnapFix`,
        html
      },
      userId,
      EmailType.SUBSCRIPTION_EXPIRY_REMINDER
    );
  }

  /**
   * Send subscription expired notification
   */
  public async sendSubscriptionExpiredEmail(
    email: string,
    firstName: string,
    subscriptionTier: string,
    userId: string
  ): Promise<boolean> {
    const html = this.getSubscriptionExpiredTemplate(firstName, subscriptionTier);

    return this.sendEmail(
      {
        to: email,
        subject: `❌ Вашият ${subscriptionTier} абонамент изтече - SnapFix`,
        html
      },
      userId,
      EmailType.SUBSCRIPTION_EXPIRED
    );
  }

  // =====================
  // Email Templates
  // =====================

  private getBaseEmailTemplate(content: string): string {
    return `
<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SnapFix</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .email-wrapper {
      background-color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .header p {
      margin: 10px 0 0;
      opacity: 0.9;
    }
    .content {
      padding: 30px;
    }
    .btn {
      display: inline-block;
      padding: 14px 30px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      margin: 20px 0;
      text-align: center;
    }
    .btn:hover {
      opacity: 0.9;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .warning {
      background-color: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }
    .info-box {
      background-color: #e7f3ff;
      border: 1px solid #2196F3;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }
    .danger-box {
      background-color: #ffebee;
      border: 1px solid #f44336;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin: 8px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="email-wrapper">
      <div class="header">
        <h1>🔧 SnapFix</h1>
        <p>Платформа за майстори и клиенти</p>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} SnapFix. Всички права запазени.</p>
        <p>
          <a href="https://snapfix.bg/privacy">Политика за поверителност</a> | 
          <a href="https://snapfix.bg/terms">Условия за ползване</a>
        </p>
        <p style="margin-top: 10px;">
          Ако не сте заявили този имейл, моля игнорирайте го.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private getVerificationEmailTemplate(firstName: string, verificationUrl: string): string {
    const content = `
      <h2>Здравейте, ${firstName}! 👋</h2>
      <p>Благодарим ви, че се регистрирахте в SnapFix!</p>
      <p>За да завършите регистрацията си, моля потвърдете вашия имейл адрес като кликнете на бутона по-долу:</p>
      
      <div style="text-align: center;">
        <a href="${verificationUrl}" class="btn">✓ Потвърдете имейла си</a>
      </div>
      
      <div class="warning">
        <strong>⏰ Важно:</strong> Този линк е валиден ${config.communication.email.verification.tokenExpiryHours} часа.
      </div>
      
      <p>Ако бутонът не работи, копирайте и поставете следния линк във вашия браузър:</p>
      <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px; font-size: 12px;">
        ${verificationUrl}
      </p>
      
      <p>Ако не сте се регистрирали в SnapFix, моля игнорирайте този имейл.</p>
    `;
    return this.getBaseEmailTemplate(content);
  }

  private getPasswordResetEmailTemplate(firstName: string, resetUrl: string): string {
    const content = `
      <h2>Здравейте, ${firstName}! 🔑</h2>
      <p>Получихме заявка за възстановяване на паролата за вашия акаунт.</p>
      <p>За да създадете нова парола, кликнете на бутона по-долу:</p>
      
      <div style="text-align: center;">
        <a href="${resetUrl}" class="btn">🔐 Създайте нова парола</a>
      </div>
      
      <div class="danger-box">
        <strong>⚠️ Внимание:</strong> Този линк е валиден само ${config.communication.email.passwordReset.tokenExpiryHours} час. 
        Ако не сте заявили възстановяване на парола, някой може да се опитва да получи достъп до вашия акаунт.
      </div>
      
      <p>Ако бутонът не работи, копирайте и поставете следния линк във вашия браузър:</p>
      <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px; font-size: 12px;">
        ${resetUrl}
      </p>
      
      <div class="info-box">
        <strong>💡 Съвети за сигурност:</strong>
        <ul>
          <li>Използвайте уникална парола само за SnapFix</li>
          <li>Паролата трябва да съдържа поне 8 символа</li>
          <li>Включете главни букви, цифри и специални символи</li>
        </ul>
      </div>
    `;
    return this.getBaseEmailTemplate(content);
  }

  private getWelcomeEmailTemplate(firstName: string, role: string): string {
    const isProvider = role === 'tradesperson';
    const roleSpecificContent = isProvider ? `
      <div class="info-box">
        <strong>🛠️ Като майстор в SnapFix можете:</strong>
        <ul>
          <li>Да получавате заявки от клиенти</li>
          <li>Да наддавате за проекти</li>
          <li>Да изградите репутация чрез отзиви</li>
          <li>Да управлявате графика си</li>
        </ul>
      </div>
      <p><strong>Следваща стъпка:</strong> Попълнете профила си, за да се появите в търсенията на клиенти!</p>
    ` : `
      <div class="info-box">
        <strong>🏠 Като клиент в SnapFix можете:</strong>
        <ul>
          <li>Да намерите проверени майстори</li>
          <li>Да получите оферти за вашия проект</li>
          <li>Да сравните цени и отзиви</li>
          <li>Да комуникирате директно с майсторите</li>
        </ul>
      </div>
      <p><strong>Следваща стъпка:</strong> Публикувайте първата си заявка!</p>
    `;

    const content = `
      <h2>Добре дошли в SnapFix, ${firstName}! 🎉</h2>
      <p>Благодарим ви, че се присъединихте към нашата платформа!</p>
      
      ${roleSpecificContent}
      
      <div style="text-align: center;">
        <a href="https://snapfix.bg/dashboard" class="btn">🚀 Към вашия профил</a>
      </div>
      
      <p>Ако имате въпроси, не се колебайте да се свържете с нас на <a href="mailto:support@snapfix.bg">support@snapfix.bg</a></p>
    `;
    return this.getBaseEmailTemplate(content);
  }

  private getSubscriptionExpiryReminderTemplate(
    firstName: string,
    daysRemaining: number,
    subscriptionTier: string,
    expiryDate: Date
  ): string {
    const tierName = this.getTierDisplayName(subscriptionTier);
    const formattedDate = expiryDate.toLocaleDateString('bg-BG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const urgencyClass = daysRemaining <= 1 ? 'danger-box' : daysRemaining <= 3 ? 'warning' : 'info-box';
    const urgencyIcon = daysRemaining <= 1 ? '🚨' : daysRemaining <= 3 ? '⚠️' : '📅';

    const content = `
      <h2>Здравейте, ${firstName}! ${urgencyIcon}</h2>
      
      <div class="${urgencyClass}">
        <strong>Вашият ${tierName} абонамент изтича след ${daysRemaining} ${daysRemaining === 1 ? 'ден' : 'дни'}!</strong>
        <p style="margin: 10px 0 0;">Дата на изтичане: <strong>${formattedDate}</strong></p>
      </div>
      
      <p>За да продължите да използвате всички функции на SnapFix, моля подновете абонамента си навреме.</p>
      
      <div class="info-box">
        <strong>📋 Какво ще загубите при изтичане:</strong>
        <ul>
          <li>Достъп до нови заявки</li>
          <li>Възможност за наддаване</li>
          <li>SMS известия</li>
          <li>Приоритетно показване в търсенията</li>
        </ul>
      </div>
      
      <div style="text-align: center;">
        <a href="https://snapfix.bg/subscription" class="btn">🔄 Поднови абонамента</a>
      </div>
      
      <p>Ако имате въпроси относно абонамента си, свържете се с нас на <a href="mailto:support@snapfix.bg">support@snapfix.bg</a></p>
    `;
    return this.getBaseEmailTemplate(content);
  }

  private getSubscriptionExpiredTemplate(firstName: string, subscriptionTier: string): string {
    const tierName = this.getTierDisplayName(subscriptionTier);

    const content = `
      <h2>Здравейте, ${firstName}! ❌</h2>
      
      <div class="danger-box">
        <strong>Вашият ${tierName} абонамент изтече.</strong>
        <p style="margin: 10px 0 0;">Някои функции на вашия акаунт са временно ограничени.</p>
      </div>
      
      <p>За да възстановите пълния достъп до SnapFix, моля подновете абонамента си.</p>
      
      <div class="info-box">
        <strong>🔒 Ограничени функции:</strong>
        <ul>
          <li>Не можете да получавате нови заявки</li>
          <li>Не можете да наддавате за проекти</li>
          <li>SMS известията са спрени</li>
          <li>Профилът ви не се показва в търсенията</li>
        </ul>
      </div>
      
      <div style="text-align: center;">
        <a href="https://snapfix.bg/subscription" class="btn">🔓 Поднови абонамента сега</a>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        <strong>💡 Добра новина:</strong> Всички ваши данни, история и отзиви са запазени. 
        След подновяване на абонамента ще можете да продължите от там, където сте спрели.
      </p>
    `;
    return this.getBaseEmailTemplate(content);
  }

  private getTierDisplayName(tier: string): string {
    const tierNames: Record<string, string> = {
      'free': 'Безплатен',
      'normal': 'Стандартен',
      'pro': 'Професионален'
    };
    return tierNames[tier] || tier;
  }

  // =====================
  // Utility Methods
  // =====================

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  private async logEmail(
    id: string,
    userId: string | null,
    emailTo: string,
    emailType: string,
    subject: string,
    status: string
  ): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO email_logs (id, user_id, email_to, email_type, subject, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [id, userId, emailTo, emailType, subject, status]
      );
    } catch (error) {
      logger.error('Failed to log email', { error, emailTo, emailType });
    }
  }

  private async updateEmailLog(id: string, status: string, errorMessage?: string): Promise<void> {
    try {
      if (status === 'sent') {
        await this.database.query(
          `UPDATE email_logs SET status = $1, sent_at = NOW() WHERE id = $2`,
          [status, id]
        );
      } else {
        await this.database.query(
          `UPDATE email_logs SET status = $1, error_message = $2 WHERE id = $3`,
          [status, errorMessage || null, id]
        );
      }
    } catch (error) {
      logger.error('Failed to update email log', { error, id, status });
    }
  }

  /**
   * Mark user email as verified
   */
  public async markEmailVerified(userId: string): Promise<void> {
    await this.database.query(
      `UPDATE users SET email_verified = TRUE, email_verified_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [userId]
    );
    logger.info('📧 Email marked as verified', { userId });
  }

  /**
   * Check if email service is configured
   */
  public isServiceConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Test email configuration by sending a test email
   */
  public async sendTestEmail(to: string): Promise<boolean> {
    const content = `
      <h2>🧪 Test Email</h2>
      <p>This is a test email from SnapFix email service.</p>
      <p>If you received this email, the email configuration is working correctly!</p>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
    `;

    return this.sendEmail({
      to,
      subject: '🧪 Test Email - SnapFix',
      html: this.getBaseEmailTemplate(content)
    });
  }
}

export default EmailService.getInstance();
