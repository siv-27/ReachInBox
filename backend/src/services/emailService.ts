import nodemailer from 'nodemailer';
import { config } from '../config/env';

export interface SendEmailResult {
  messageId: string;
  previewUrl?: string;
}

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  /**
   * Instantiate or return the singleton Nodemailer SMTP transporter configured for Ethereal Email
   */
  private static getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      if (!config.etherealUser || !config.etherealPassword) {
        throw new Error('Ethereal SMTP credentials are not configured in the environment variables.');
      }

      this.transporter = nodemailer.createTransport({
        host: config.etherealHost || 'smtp.ethereal.email',
        port: config.etherealPort || 587,
        secure: config.etherealPort === 465, // true for 465, false for 587/25
        auth: {
          user: config.etherealUser,
          pass: config.etherealPassword,
        },
      });
    }
    return this.transporter;
  }

  /**
   * Send email using Nodemailer and Ethereal SMTP.
   * Supports both (sender, recipient, subject, body) and ({ sender, recipient, subject, body }) signatures.
   */
  static async sendEmail(
    senderOrObject: string | { sender: string; recipient: string; subject: string; body: string },
    recipient?: string,
    subject?: string,
    body?: string
  ): Promise<SendEmailResult> {
    let finalSender: string;
    let finalRecipient: string;
    let finalSubject: string;
    let finalBody: string;

    if (typeof senderOrObject === 'object') {
      finalSender = senderOrObject.sender;
      finalRecipient = senderOrObject.recipient;
      finalSubject = senderOrObject.subject;
      finalBody = senderOrObject.body;
    } else {
      finalSender = senderOrObject;
      finalRecipient = recipient || '';
      finalSubject = subject || '';
      finalBody = body || '';
    }

    const transporter = this.getTransporter();

    const mailOptions = {
      from: finalSender,
      to: finalRecipient,
      subject: finalSubject,
      text: finalBody,
      html: finalBody.replace(/\n/g, '<br>'), // convert line breaks to HTML
    };

    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;

    return {
      messageId: info.messageId,
      previewUrl,
    };
  }
}

// Named export for compatibility with tests expecting a direct functional import
export const sendEmail = EmailService.sendEmail.bind(EmailService);
