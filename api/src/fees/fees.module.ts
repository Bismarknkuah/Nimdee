import { Module } from '@nestjs/common';
import { FeesController } from './fees.controller';
import { FeesCron } from './fees.cron';
import { FeesService } from './fees.service';
import { PaymentsGatewayService } from './payments.service';
import { FeeRemindersService } from './reminders.service';

@Module({
  controllers: [FeesController],
  providers: [FeesService, PaymentsGatewayService, FeesCron, FeeRemindersService],
  exports: [FeesService, PaymentsGatewayService, FeeRemindersService],
})
export class FeesModule {}
