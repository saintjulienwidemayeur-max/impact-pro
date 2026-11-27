import { Injectable } from '@nestjs/common';
import { MailNotConfiguredError, type DocumentMailer } from '../ports/document-mailer.port';

/** Default `DOCUMENT_MAILER`: no mail provider yet. The mail module (stage 2) overrides this provider. */
@Injectable()
export class NotConfiguredDocumentMailer implements DocumentMailer {
  send(): Promise<{ messageId: string }> {
    return Promise.reject(new MailNotConfiguredError());
  }
}
