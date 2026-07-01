import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportInsightService } from './report-insight.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportInsightService],
  exports: [ReportsService, ReportInsightService],
})
export class ReportsModule {}
