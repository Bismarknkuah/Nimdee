import { Module } from '@nestjs/common';
import { FeesModule } from '../fees/fees.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [FeesModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
