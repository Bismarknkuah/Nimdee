import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { CanteenModule } from '../canteen/canteen.module';
import { FeesModule } from '../fees/fees.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AttendanceModule, FeesModule, CanteenModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
