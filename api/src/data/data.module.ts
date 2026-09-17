import { Global, Module } from '@nestjs/common';
import { DataController } from './data.controller';
import { DataExportService } from './data-export.service';

@Global()
@Module({ controllers: [DataController], providers: [DataExportService], exports: [DataExportService] })
export class DataModule {}
