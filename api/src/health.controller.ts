import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}
  @Public()
  @Get('health')
  async health() {
    let db = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      db = `error: ${(e as Error).message}`;
    }
    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      db,
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? '1.0.0',
      time: new Date().toISOString(),
    };
  }
}
