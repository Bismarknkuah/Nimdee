import { Global, Module } from '@nestjs/common';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { ProvidersService } from './providers.service';

@Global()
@Module({
  controllers: [CommunicationsController],
  providers: [CommunicationsService, ProvidersService],
  exports: [CommunicationsService, ProvidersService],
})
export class CommunicationsModule {}
