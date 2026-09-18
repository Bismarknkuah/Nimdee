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

  /**
   * Demo accounts for the "Quick demo access" buttons on the login pages.
   * Only returned when the seeded demo school exists and DEMO_MODE is not set to "false".
   */
  @Get('demo-accounts')
  async demoAccounts() {
    if (process.env.DEMO_MODE === 'false') return { enabled: false };
    const tenant = await this.prisma.platform.tenant.findUnique({
      where: { slug: 'brightfuture' },
      select: { id: true, slug: true, name: true, code: true, status: true },
    });
    if (!tenant || tenant.status !== 'ACTIVE') return { enabled: false };
    const emails = [
      ['admin@brightfuture.edu.gh', 'School administrator', 'admin'],
      ['proprietor@brightfuture.edu.gh', 'Proprietor', 'owner'],
      ['headmaster@brightfuture.edu.gh', 'Headmaster', 'admin'],
      ['teacher@brightfuture.edu.gh', 'Class teacher (Basic 5)', 'teacher'],
      ['formmaster@brightfuture.edu.gh', 'Form master (JHS 1)', 'teacher'],
      ['teacher2@brightfuture.edu.gh', 'Subject teacher', 'teacher'],
      ['accounts@brightfuture.edu.gh', 'Accounts officer', 'finance'],
      ['canteen@brightfuture.edu.gh', 'Canteen manager', 'canteen'],
      ['nurse@brightfuture.edu.gh', 'School nurse', 'staff'],
      ['librarian@brightfuture.edu.gh', 'Librarian', 'staff'],
      ['hr@brightfuture.edu.gh', 'HR officer', 'staff'],
      ['parent@brightfuture.edu.gh', 'Parent (2 children)', 'parent'],
      ['student@brightfuture.edu.gh', 'Student', 'student'],
    ] as const;
    const existing = await this.prisma.platform.user.findMany({
      where: { tenantId: tenant.id, email: { in: emails.map((e) => e[0]) }, isActive: true },
      select: { email: true, firstName: true, lastName: true },
    });
    const platformOwner = await this.prisma.platform.platformUser.findFirst({
      where: { email: 'admin@schoolos.app', isActive: true },
      select: { email: true },
    });
    return {
      enabled: true,
      school: { slug: tenant.slug, name: tenant.name, code: tenant.code },
      password: 'Password123!',
      accounts: emails
        .filter(([email]) => existing.some((u) => u.email === email))
        .map(([email, label, kind]) => {
          const u = existing.find((x) => x.email === email)!;
          return { email, label, kind, name: `${u.firstName} ${u.lastName}` };
        }),
      platform: platformOwner ? { email: platformOwner.email, label: 'Platform owner' } : null,
    };
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
