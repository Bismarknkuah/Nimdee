import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { CanteenModule } from '../canteen/canteen.module';
import { FeesModule } from '../fees/fees.module';
import { ResultsModule } from '../results/results.module';
import { TimetableModule } from '../timetable/timetable.module';
import { AssignmentsModule } from '../assignments/assignments.module';
import { DisciplineModule } from '../discipline/discipline.module';
import { HealthModule } from '../health/health.module';
import { TransportModule } from '../transport/transport.module';
import { LibraryModule } from '../library/library.module';
import { EventsModule } from '../events/events.module';
import { MessagingModule } from '../messaging/messaging.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [
    AttendanceModule,
    FeesModule,
    ResultsModule,
    TimetableModule,
    CanteenModule,
    AssignmentsModule,
    DisciplineModule,
    HealthModule,
    TransportModule,
    LibraryModule,
    EventsModule,
    MessagingModule,
  ],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
