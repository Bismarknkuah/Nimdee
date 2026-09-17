import { Global, Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { PdfService } from './pdf.service';

@Global()
@Module({ controllers: [DocumentsController], providers: [PdfService], exports: [PdfService] })
export class PdfModule {}
