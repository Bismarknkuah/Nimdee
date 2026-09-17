import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BootstrapService } from './bootstrap.service';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({ imports: [AuthModule], controllers: [PlatformController], providers: [PlatformService, BootstrapService] })
export class PlatformModule {}
