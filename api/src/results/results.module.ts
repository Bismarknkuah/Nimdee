import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';

@Module({
  imports: [StudentsModule],
  controllers: [ResultsController],
  providers: [ResultsService],
  exports: [ResultsService],
})
export class ResultsModule {}
