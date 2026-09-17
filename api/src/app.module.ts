import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { contextMiddleware } from './common/context/context.middleware';
import { FeatureGuard } from './common/guards/feature.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { TenantCacheModule } from './tenants/tenant-cache.module';
import { PdfModule } from './pdf/pdf.module';
import { AuthModule } from './auth/auth.module';
import { PlatformModule } from './platform/platform.module';
import { SchoolsModule } from './schools/schools.module';
import { UsersModule } from './users/users.module';
import { AcademicModule } from './academic/academic.module';
import { StudentsModule } from './students/students.module';
import { StaffModule } from './staff/staff.module';
import { AttendanceModule } from './attendance/attendance.module';
import { SyncModule } from './sync/sync.module';
import { FeesModule } from './fees/fees.module';
import { ResultsModule } from './results/results.module';
import { TimetableModule } from './timetable/timetable.module';
import { CanteenModule } from './canteen/canteen.module';
import { InventoryModule } from './inventory/inventory.module';
import { CommunicationsModule } from './communications/communications.module';
import { AdmissionsModule } from './admissions/admissions.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PortalModule } from './portal/portal.module';
import { ExportsModule } from './exports/exports.module';
import { PublicModule } from './public/public.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { DisciplineModule } from './discipline/discipline.module';
import { EventsModule } from './events/events.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { LibraryModule } from './library/library.module';
import { TransportModule } from './transport/transport.module';
import { HealthModule } from './health/health.module';
import { MessagingModule } from './messaging/messaging.module';
import { HrModule } from './hr/hr.module';
import { ReportsModule } from './reports/reports.module';
import { DataModule } from './data/data.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    TenantCacheModule,
    PdfModule,
    CommunicationsModule,
    DataModule,
    AnalyticsModule,
    AuthModule,
    PlatformModule,
    SchoolsModule,
    UsersModule,
    AcademicModule,
    StudentsModule,
    StaffModule,
    AttendanceModule,
    SyncModule,
    FeesModule,
    ResultsModule,
    TimetableModule,
    CanteenModule,
    InventoryModule,
    AdmissionsModule,
    DashboardModule,
    PortalModule,
    ExportsModule,
    PublicModule,
    SubscriptionsModule,
    DisciplineModule,
    EventsModule,
    AssignmentsModule,
    LibraryModule,
    TransportModule,
    HealthModule,
    MessagingModule,
    HrModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Guard order matters: rate-limit → authenticate → tenant environment → permissions → plan features
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: FeatureGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(contextMiddleware).forRoutes('*');
  }
}
