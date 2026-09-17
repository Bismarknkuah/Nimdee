import { Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolsService } from '../schools/schools.service';
import { RegisterSchoolDto } from '../schools/dto';
import { AdmissionsService } from '../admissions/admissions.service';
import { ApplyDto } from '../admissions/dto';
import { PaymentsGatewayService } from '../fees/payments.service';

/** Unauthenticated endpoints: school websites, onboarding, online admissions, payment webhooks. */
@ApiTags('public')
@Public()
@Controller('public')
export class PublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schools: SchoolsService,
    private readonly admissions: AdmissionsService,
    private readonly gateway: PaymentsGatewayService,
  ) {}

  @Get('site/:slug') site(@Param('slug') slug: string) {
    return this.schools.publicSite(slug);
  }
  @Get('resolve-host') resolve(@Query('host') host: string) {
    return this.schools.resolveHost(host);
  }

  @Get('plans')
  plans() {
    return this.prisma.platform.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        priceMonthly: true,
        priceYearly: true,
        currency: true,
        studentLimit: true,
        features: true,
        trialDays: true,
      },
    });
  }

  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post('schools/register')
  register(@Body() dto: RegisterSchoolDto) {
    return this.schools.register(dto);
  }

  @Get('schools/:slug/classes')
  async classes(@Param('slug') slug: string) {
    const t = await this.prisma.platform.tenant.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true, status: true },
    });
    if (!t || t.status !== 'ACTIVE') return [];
    return this.prisma.forTenant(t.id).schoolClass.findMany({
      select: { id: true, name: true, level: true },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
  }

  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post('admissions/:slug/apply')
  apply(@Param('slug') slug: string, @Body() dto: ApplyDto) {
    return this.admissions.apply(slug, dto);
  }

  @Post('webhooks/paystack')
  webhook(@Req() req: any, @Headers('x-paystack-signature') signature?: string) {
    return this.gateway.webhook(req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {})), signature);
  }
}
