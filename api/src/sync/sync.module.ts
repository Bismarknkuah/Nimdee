import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { StudentsModule } from '../students/students.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [AttendanceModule, StudentsModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
