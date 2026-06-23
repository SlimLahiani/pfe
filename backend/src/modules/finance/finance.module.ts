import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { FinanceAnalyticsService } from './finance-analytics.service';
import { FinanceAnalyticsController } from './finance-analytics.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [FinanceController, FinanceAnalyticsController],
  providers: [FinanceService, FinanceAnalyticsService],
  exports: [FinanceService, FinanceAnalyticsService],
})
export class FinanceModule {}
