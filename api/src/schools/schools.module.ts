import { Module } from '@nestjs/common';
import { AcademicModule } from '../academic/academic.module';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';

@Module({ imports: [AcademicModule], controllers: [SchoolsController], providers: [SchoolsService], exports: [SchoolsService] })
export class SchoolsModule {}
