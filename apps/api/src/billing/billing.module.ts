import { Module } from '@nestjs/common';
import { StaffGuard } from '../admin/rbac/staff.guard';
import { AuthModule } from '../auth/auth.module';
import { BillingSettingsController, ReportsController } from './billing-admin.controller';
import { BillingSettingsService } from './billing-settings.service';
import { BillingStatsService } from './billing-stats.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { NotConfiguredDocumentMailer } from './mailer/not-configured-document-mailer';
import { NumberingService } from './numbering.service';
import { PdfService } from './pdf.service';
import { DOCUMENT_MAILER } from './ports/document-mailer.port';
import { PublicDocumentsController } from './public-documents.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuthModule],
  // `documents/export.csv` is declared before `documents/:id` inside DocumentsController.
  controllers: [DocumentsController, BillingSettingsController, ReportsController, PublicDocumentsController],
  providers: [
    DocumentsService,
    BillingSettingsService,
    BillingStatsService,
    ReportsService,
    NumberingService,
    PdfService,
    StaffGuard,
    // Default: no mail provider. The mail module overrides this token with a real implementation.
    { provide: DOCUMENT_MAILER, useClass: NotConfiguredDocumentMailer },
  ],
  exports: [DocumentsService, BillingSettingsService, BillingStatsService, DOCUMENT_MAILER],
})
export class BillingModule {}
