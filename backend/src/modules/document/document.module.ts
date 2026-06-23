import { Module, Global } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { PdfController } from './pdf.controller';
import { EmailAutomationService } from './email-automation.service';
import { EmailCronService } from './email-cron.service';
import { EmailTrackingController } from './email-tracking.controller';

@Global()
@Module({
  controllers: [DocumentController, PdfController, EmailTrackingController],
  providers: [PdfService, DocumentService, EmailAutomationService, EmailCronService],
  exports: [PdfService, DocumentService, EmailAutomationService],
})
export class DocumentModule {}
