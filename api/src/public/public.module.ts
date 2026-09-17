import { Module } from '@nestjs/common';
import { AdmissionsModule } from '../admissions/admissions.module';
import { FeesModule } from '../fees/fees.module';
import { SchoolsModule } from '../schools/schools.module';
import { PublicController } from './public.controller';

@Module({ imports: [SchoolsModule, AdmissionsModule, FeesModule], controllers: [PublicController] })
export class PublicModule {}
