import { Module } from '@nestjs/common';
import { FeesModule } from '../fees/fees.module';
import { CanteenController } from './canteen.controller';
import { CanteenService } from './canteen.service';
import { CanteenPlansController } from './plans.controller';
import { CanteenPlansService } from './plans.service';

@Module({
  imports: [FeesModule],
  controllers: [CanteenPlansController, CanteenController],
  providers: [CanteenService, CanteenPlansService],
  exports: [CanteenService, CanteenPlansService],
})
export class CanteenModule {}
