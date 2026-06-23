import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DocumentModule } from './modules/document/document.module';
import { CrmModule } from './modules/crm/crm.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HrModule } from './modules/hr/hr.module';
import { ChatModule } from './modules/chat/chat.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { IntelligenceModule } from './modules/intelligence/intelligence.module';
import { AuditLogInterceptor } from './core/interceptors/audit-log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    // Core Infrastructure
    AuthModule,
    UsersModule,
    RbacModule,
    NotificationsModule,
    DocumentModule,
    AuditModule,
    // Business Modules
    CrmModule,
    ProjectsModule,
    TasksModule,
    FinanceModule,
    HrModule,
    ChatModule,
    CalendarModule,
    ReportsModule,
    IntelligenceModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
