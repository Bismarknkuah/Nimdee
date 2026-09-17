import { Module } from '@nestjs/common';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';
import { RolloverService } from './rollover.service';

@Module({
  controllers: [AcademicController],
  providers: [AcademicService, RolloverService],
  exports: [AcademicService],
})
export class AcademicModule {}
