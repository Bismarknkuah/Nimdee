import { Module } from '@nestjs/common';
import { FeesModule } from '../fees/fees.module';
import { StudentsModule } from '../students/students.module';
import { DisciplineController } from './discipline.controller';
import { DisciplineService } from './discipline.service';

@Module({
  imports: [StudentsModule, FeesModule],
  controllers: [DisciplineController],
  providers: [DisciplineService],
  exports: [DisciplineService],
})
export class DisciplineModule {}
