export const DOCUMENT_MAILER = Symbol('DOCUMENT_MAILER');
export interface DocumentMailAttachment { filename: string; content: Buffer; contentType: string }
export interface DocumentMailInput {
  to: string[]; cc?: string[]; bcc?: string[]; subject: string; text: string; html?: string;
  attachments: DocumentMailAttachment[];
  context: { documentId: string; orderId?: string; customerId?: string; actorId: string };
}
export interface DocumentMailer {
  /** Throws `MailNotConfiguredError` (HTTP 503 MAIL_NOT_CONFIGURED) when no provider is configured. */
  send(input: DocumentMailInput): Promise<{ messageId: string }>;
}
export class MailNotConfiguredError extends Error { constructor() { super('Mail is not configured'); } }
