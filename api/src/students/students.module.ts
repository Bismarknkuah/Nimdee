import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { GuardiansService } from './guardians.service';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { StudentImportService } from './import.service';

@Module({
  imports: [UsersModule],
  controllers: [StudentsController],
  providers: [StudentsService, GuardiansService, StudentImportService],
  exports: [StudentsService, GuardiansService, StudentImportService],
})
export class StudentsModule {}
