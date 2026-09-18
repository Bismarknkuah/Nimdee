import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { promises as dns } from 'dns';
import { PrismaService } from '../prisma/prisma.service';
import { AcademicService } from '../academic/academic.service';
import { requestContext } from '../common/context/request-context';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { tid } from '../common/context/request-context';
import { SYSTEM_ROLES } from '../common/permissions';
import { ALL_FEATURES, CORE_FEATURES } from '../common/features';
import { DEFAULT_SETTINGS, defaultWebsiteConfig, mergeSettings, validateSettings } from '../common/settings';
import { nextSequence, pad, randomPassword, randomToken, slugify } from '../common/utils';
import {
  AddDomainDto,
  RegisterSchoolDto,
  PlatformCreateSchoolDto,
  UpdateBrandingDto,
  UpdateFeaturesDto,
  UpdateSchoolProfileDto,
  UpdateSettingsDto,
  WebsiteConfigDto,
} from './dto';

const ROOT_DOMAIN = () => (process.env.ROOT_DOMAIN || 'localhost').toLowerCase();

@Injectable()
export class SchoolsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private cache: TenantCacheService,
    private readonly academic: AcademicService,
  ) {}

  // ─────────────────────────── Onboarding ───────────────────────────
  async register(dto: RegisterSchoolDto | PlatformCreateSchoolDto, opts?: { forceApprove?: boolean }) {
    let slug = dto.slug ? dto.slug.toLowerCase() : slugify(dto.name);
    if (['www', 'api', 'app', 'admin', 'platform', 'mail'].includes(slug))
      throw new BadRequestException('That address is reserved');
    const taken = await this.prisma.platform.tenant.findUnique({ where: { slug } });
    if (taken) {
      if (dto.slug) throw new ConflictException('That school address is already taken');
      slug = `${slug}-${Math.floor(Math.random() * 9000 + 1000)}`;
    }
    const plan =
      (await this.prisma.platform.plan.findFirst({ where: { code: dto.planCode ?? 'STARTER', isActive: true } })) ??
      (await this.prisma.platform.plan.findFirst({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }));
    if (!plan) throw new BadRequestException('No subscription plans are configured yet');
    const country = (dto.country ?? 'GH').toUpperCase();
    const autoApprove = opts?.forceApprove || process.env.PLATFORM_AUTO_APPROVE === 'true';
    const adminEmail = dto.adminEmail.trim().toLowerCase();
    const generatedPassword = dto.adminPassword ? undefined : randomPassword();
    const passwordHash = await bcrypt.hash(dto.adminPassword || generatedPassword!, 10);

    const result = await this.prisma.platformTx(async (tx) => {
      let code = '';
      for (let attempt = 0; attempt < 50; attempt++) {
        code = `SCH-${country}-${pad(await nextSequence(tx, 'PLATFORM', 'school'), 6)}`;
        if (!(await tx.tenant.findUnique({ where: { code }, select: { id: true } }))) break;
      }
      const now = new Date();
      const trialEnd = new Date(now.getTime() + plan.trialDays * 86400000);
      const tenant = await tx.tenant.create({
        data: {
          code,
          slug,
          name: dto.name.trim(),
          type: dto.type ?? 'BASIC',
          country,
          region: dto.region,
          district: dto.district,
          address: dto.address,
          phone: dto.phone,
          email: dto.email?.toLowerCase(),
          registrationNumber: dto.registrationNumber,
          status: autoApprove ? 'ACTIVE' : 'PENDING',
          approvedAt: autoApprove ? now : null,
          settings: { ...DEFAULT_SETTINGS, school: { ...DEFAULT_SETTINGS.school, levels: dto.levels?.length ? dto.levels : DEFAULT_SETTINGS.school.levels, residency: dto.residency ?? DEFAULT_SETTINGS.school.residency } } as any,
          websiteConfig: defaultWebsiteConfig(dto.name.trim()) as any,
          domains: {
            create: {
              domain: `${slug}.${ROOT_DOMAIN()}`,
              type: 'SUBDOMAIN',
              isPrimary: true,
              verified: true,
              verifiedAt: now,
            },
          },
          subscription: {
            create: {
              planId: plan.id,
              status: 'TRIAL',
              billingCycle: 'YEARLY',
              trialEndsAt: trialEnd,
              currentPeriodStart: now,
              currentPeriodEnd: trialEnd,
            },
          },
        },
      });
      const roles = await Promise.all(
        Object.entries(SYSTEM_ROLES).map(([name, r]) =>
          tx.role.create({
            data: { tenantId: tenant.id, name, description: r.description, isSystem: true, permissions: r.permissions },
          }),
        ),
      );
      const adminRole = roles.find((r) => r.name === 'School Admin');
      const admin = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: adminEmail,
          passwordHash,
          firstName: dto.adminFirstName,
          lastName: dto.adminLastName,
          userType: 'STAFF',
          roles: { create: [{ tenantId: tenant.id, roleId: adminRole.id }] },
        },
      });
      // Default academic year + terms so the school can start immediately (editable under Academics).
      const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
      const year = await tx.academicYear.create({
        data: {
          tenantId: tenant.id,
          name: `${y}/${y + 1}`,
          startDate: new Date(Date.UTC(y, 8, 1)),
          endDate: new Date(Date.UTC(y + 1, 6, 31)),
          isCurrent: true,
        },
      });
      const termDefs = [
        ['Term 1', new Date(Date.UTC(y, 8, 1)), new Date(Date.UTC(y, 11, 15))],
        ['Term 2', new Date(Date.UTC(y + 1, 0, 8)), new Date(Date.UTC(y + 1, 3, 10))],
        ['Term 3', new Date(Date.UTC(y + 1, 3, 28)), new Date(Date.UTC(y + 1, 6, 31))],
      ] as const;
      const currentTermIdx = termDefs.findIndex(([, s, e]) => now >= s && now <= e);
      await Promise.all(
        termDefs.map(([name, s, e], i) =>
          tx.term.create({
            data: {
              tenantId: tenant.id,
              academicYearId: year.id,
              name,
              sequence: i + 1,
              startDate: s,
              endDate: e,
              isCurrent: i === (currentTermIdx === -1 ? 0 : currentTermIdx),
            },
          }),
        ),
      );
      return { tenant, admin };
    });

    // Standard KG/Primary/JHS classes and GES subjects for the levels the school runs (opt-out via setupStandardClasses=false).
    if (dto.setupStandardClasses !== false) {
      await requestContext.run(
        { tenantId: result.tenant.id, userId: result.admin.id, actorType: 'TENANT', actorName: adminEmail, permissions: ['*'] } as any,
        () => this.academic.ghanaBasicSetup({ levels: dto.levels?.length ? dto.levels : undefined }),
      );
    }

    await this.audit.log({
      action: 'SCHOOL_REGISTERED',
      entity: 'Tenant',
      entityId: result.tenant.id,
      tenantId: result.tenant.id,
      after: { code: result.tenant.code, slug, plan: plan.code },
      actorName: adminEmail,
      actorType: 'TENANT',
      actorId: result.admin.id,
    });
    return {
      school: {
        id: result.tenant.id,
        code: result.tenant.code,
        slug,
        name: result.tenant.name,
        status: result.tenant.status,
      },
      portalUrl: `https://${slug}.${ROOT_DOMAIN()}`,
      loginHint: { school: slug, email: adminEmail },
      temporaryPassword: generatedPassword,
      message: autoApprove
        ? 'Your school is ready. Sign in to continue.'
        : 'Registration received. The platform administrator will review and approve your school shortly.',
    };
  }

  // ─────────────────────────── Self-service profile ───────────────────────────
  async profile() {
    const t = await this.prisma.db.tenant.findUnique({
      where: { id: tid() },
      include: { domains: true, subscription: { include: { plan: true } } },
    });
    if (!t) throw new NotFoundException('School not found');
    const { settings, websiteConfig, ...rest } = t;
    return { ...rest, settings: mergeSettings(settings) };
  }

  async updateProfile(dto: UpdateSchoolProfileDto) {
    const before = await this.prisma.db.tenant.findUnique({ where: { id: tid() } });
    const t = await this.prisma.db.tenant.update({ where: { id: tid() }, data: { ...dto } });
    this.cache.invalidate(tid());
    await this.audit.log({
      action: 'SCHOOL_PROFILE_UPDATED',
      entity: 'Tenant',
      entityId: t.id,
      before: pick(before, Object.keys(dto)),
      after: dto,
    });
    return t;
  }

  async updateBranding(dto: UpdateBrandingDto) {
    const t = await this.prisma.db.tenant.update({ where: { id: tid() }, data: { ...dto } });
    this.cache.invalidate(tid());
    await this.audit.log({ action: 'SCHOOL_BRANDING_UPDATED', entity: 'Tenant', entityId: t.id, after: dto });
    return {
      logoUrl: t.logoUrl,
      faviconUrl: t.faviconUrl,
      primaryColor: t.primaryColor,
      secondaryColor: t.secondaryColor,
      fontFamily: t.fontFamily,
    };
  }

  async getSettings() {
    const t = await this.prisma.db.tenant.findUnique({ where: { id: tid() }, select: { settings: true } });
    const s: any = mergeSettings(t.settings);
    if (s.finance?.paystackSecretKey) s.finance.paystackSecretKeySet = true;
    delete s.finance?.paystackSecretKey;
    return s;
  }

  /**
   * Every feature the school's own admins can choose to hide from staff and parents. `planFeatures` is
   * everything their plan (plus any platform-granted bonus) makes available; `disabledFeatures` is what
   * they've turned off; `locked` are the always-on essentials no plan-holder can disable.
   */
  async getFeatureSettings() {
    const t = await this.prisma.db.tenant.findUnique({
      where: { id: tid() },
      select: { featureOverrides: true, disabledFeatures: true, subscription: { select: { plan: { select: { features: true } } } } },
    });
    if (!t) throw new NotFoundException('School not found');
    const planFeatures = [...new Set([...CORE_FEATURES, ...(t.featureOverrides ?? []), ...(t.subscription?.plan.features ?? [])])];
    return { planFeatures, disabledFeatures: t.disabledFeatures ?? [], locked: CORE_FEATURES };
  }

  async updateFeatureSettings(dto: UpdateFeaturesDto) {
    const bad = dto.disabledFeatures.filter((f) => !ALL_FEATURES.includes(f));
    if (bad.length) throw new BadRequestException(`Unknown feature(s): ${bad.join(', ')}`);
    const disabledFeatures = dto.disabledFeatures.filter((f) => !(CORE_FEATURES as string[]).includes(f));
    const t = await this.prisma.db.tenant.update({ where: { id: tid() }, data: { disabledFeatures } });
    this.cache.invalidate(tid());
    await this.audit.log({
      action: 'SCHOOL_FEATURES_UPDATED',
      entity: 'Tenant',
      entityId: t.id,
      after: { disabledFeatures },
    });
    return this.getFeatureSettings();
  }

  /** Rules engine update with validation. Partial sections are deep-merged with the stored values. */
  async updateSettings(dto: UpdateSettingsDto) {
    const t = await this.prisma.db.tenant.findUnique({ where: { id: tid() }, select: { settings: true } });
    const current: any = mergeSettings(t.settings);
    const next: any = { ...current };
    for (const key of Object.keys(dto)) if (dto[key]) next[key] = { ...current[key], ...dto[key] };
    if (next.finance && dto.finance && dto.finance.paystackSecretKey === '') delete next.finance.paystackSecretKey;
    if (dto.finance && dto.finance.paystackSecretKey === undefined && current.finance.paystackSecretKey)
      next.finance.paystackSecretKey = current.finance.paystackSecretKey;
    this.validateSettings(next);
    await this.prisma.db.tenant.update({ where: { id: tid() }, data: { settings: next } });
    this.cache.invalidate(tid());
    await this.audit.log({
      action: 'SCHOOL_RULES_UPDATED',
      entity: 'Tenant',
      entityId: tid(),
      before: redact(current),
      after: redact(next),
    });
    return this.getSettings();
  }

  private validateSettings(s: any) {
    try {
      validateSettings(s);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  // ─────────────────────────── Domains ───────────────────────────
  listDomains() {
    return this.prisma.db.tenantDomain.findMany({
      where: { tenantId: tid() },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async addDomain(dto: AddDomainDto) {
    const domain = dto.domain.toLowerCase().replace(/\.$/, '');
    if (domain.endsWith(`.${ROOT_DOMAIN()}`))
      throw new BadRequestException('Subdomains of the platform are assigned automatically');
    const existing = await this.prisma.platform.tenantDomain.findUnique({ where: { domain } });
    if (existing) throw new ConflictException('This domain is already registered to a school');
    const token = `schoolos-verify=${randomToken(12)}`;
    const d = await this.prisma.db.tenantDomain.create({
      data: { tenantId: tid(), domain, type: 'CUSTOM', verificationToken: token },
    });
    await this.audit.log({ action: 'DOMAIN_ADDED', entity: 'TenantDomain', entityId: d.id, after: { domain } });
    return { ...d, instructions: this.dnsInstructions(d) };
  }

  dnsInstructions(d: { domain: string; verificationToken: string | null }) {
    return {
      steps: [
        {
          type: 'TXT',
          host: `_schoolos.${d.domain}`,
          value: d.verificationToken,
          purpose: 'Proves you own the domain',
        },
        {
          type: 'CNAME',
          host: d.domain,
          value: `cname.vercel-dns.com`,
          purpose:
            'Points the domain at the school portal (SSL is issued automatically once the domain is added to the Vercel project)',
        },
      ],
    };
  }

  async verifyDomain(id: string) {
    const d = await this.prisma.db.tenantDomain.findFirst({ where: { id, tenantId: tid() } });
    if (!d) throw new NotFoundException('Domain not found');
    if (d.verified) return d;
    let found = false;
    for (const host of [`_schoolos.${d.domain}`, d.domain]) {
      try {
        const records = await dns.resolveTxt(host);
        if (records.some((r) => r.join('') === d.verificationToken)) {
          found = true;
          break;
        }
      } catch {
        /* NXDOMAIN or no TXT yet */
      }
    }
    if (!found)
      throw new BadRequestException(
        `TXT record not found yet. Add "${d.verificationToken}" to _schoolos.${d.domain} and try again (DNS can take up to an hour).`,
      );
    const updated = await this.prisma.db.tenantDomain.update({
      where: { id },
      data: { verified: true, verifiedAt: new Date() },
    });
    await this.audit.log({
      action: 'DOMAIN_VERIFIED',
      entity: 'TenantDomain',
      entityId: id,
      after: { domain: d.domain },
    });
    return updated;
  }

  async setPrimaryDomain(id: string) {
    const d = await this.prisma.db.tenantDomain.findFirst({ where: { id, tenantId: tid() } });
    if (!d) throw new NotFoundException('Domain not found');
    if (!d.verified) throw new BadRequestException('Verify the domain first');
    await this.prisma.tenantTx(async (tx) => {
      await tx.tenantDomain.updateMany({ where: { tenantId: tid() }, data: { isPrimary: false } });
      await tx.tenantDomain.update({ where: { id }, data: { isPrimary: true } });
    });
    return this.listDomains();
  }

  async deleteDomain(id: string) {
    const d = await this.prisma.db.tenantDomain.findFirst({ where: { id, tenantId: tid() } });
    if (!d) throw new NotFoundException('Domain not found');
    if (d.type === 'SUBDOMAIN') throw new BadRequestException('The platform subdomain cannot be removed');
    await this.prisma.db.tenantDomain.delete({ where: { id } });
    await this.audit.log({
      action: 'DOMAIN_REMOVED',
      entity: 'TenantDomain',
      entityId: id,
      before: { domain: d.domain },
    });
    return { ok: true };
  }

  // ─────────────────────────── Website builder ───────────────────────────
  async getWebsite() {
    const t = await this.prisma.db.tenant.findUnique({
      where: { id: tid() },
      select: { websiteConfig: true, name: true, slug: true },
    });
    const cfg: any =
      t.websiteConfig && Object.keys(t.websiteConfig as any).length ? t.websiteConfig : defaultWebsiteConfig(t.name);
    return { ...cfg, previewUrl: `https://${t.slug}.${ROOT_DOMAIN()}` };
  }

  async updateWebsite(dto: WebsiteConfigDto) {
    if (dto.sections) {
      if (!Array.isArray(dto.sections)) throw new BadRequestException('sections must be an array');
      for (const s of dto.sections)
        if (!s.id || !s.type) throw new BadRequestException('Every section needs an id and type');
    }
    const t = await this.prisma.db.tenant.findUnique({
      where: { id: tid() },
      select: { websiteConfig: true, name: true },
    });
    const current: any =
      t.websiteConfig && Object.keys(t.websiteConfig as any).length ? t.websiteConfig : defaultWebsiteConfig(t.name);
    const next = { ...current, ...stripUndefined(dto) };
    await this.prisma.db.tenant.update({ where: { id: tid() }, data: { websiteConfig: next } });
    await this.audit.log({ action: 'WEBSITE_UPDATED', entity: 'Tenant', entityId: tid() });
    return this.getWebsite();
  }

  // ─────────────────────────── Public (no auth) ───────────────────────────
  async publicSite(slug: string) {
    const t = await this.prisma.platform.tenant.findUnique({ where: { slug: slug.toLowerCase() } });
    if (!t || t.status === 'REJECTED') throw new NotFoundException('School not found');
    const news = await this.prisma.forTenant(t.id).announcement.findMany({
      where: { isPublic: true, publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      take: 6,
      select: { id: true, title: true, body: true, publishedAt: true },
    });
    const cfg: any =
      t.websiteConfig && Object.keys(t.websiteConfig as any).length ? t.websiteConfig : defaultWebsiteConfig(t.name);
    return {
      school: {
        id: t.id,
        code: t.code,
        slug: t.slug,
        name: t.name,
        status: t.status,
        logoUrl: t.logoUrl,
        faviconUrl: t.faviconUrl,
        primaryColor: t.primaryColor,
        secondaryColor: t.secondaryColor,
        fontFamily: t.fontFamily,
        address: t.address,
        phone: t.phone,
        email: t.email,
        region: t.region,
        district: t.district,
        gpsLat: t.gpsLat,
        gpsLng: t.gpsLng,
        principalName: t.principalName,
      },
      website: cfg,
      news,
    };
  }

  async resolveHost(hostRaw: string) {
    const host = (hostRaw || '')
      .toLowerCase()
      .split(':')[0]
      .replace(/^www\./, '');
    const root = ROOT_DOMAIN();
    let slug: string | null = null;
    if (host.endsWith(`.${root}`)) {
      slug =
        host
          .slice(0, -(root.length + 1))
          .split('.')
          .pop() ?? null;
    }
    if (slug) {
      const t = await this.prisma.platform.tenant.findUnique({
        where: { slug },
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          logoUrl: true,
          primaryColor: true,
          secondaryColor: true,
        },
      });
      return t ? { found: true, tenant: t } : { found: false };
    }
    const d = await this.prisma.platform.tenantDomain.findFirst({
      where: { domain: host, verified: true },
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
          },
        },
      },
    });
    return d ? { found: true, tenant: d.tenant } : { found: false };
  }
}

function pick(obj: any, keys: string[]) {
  const out: any = {};
  for (const k of keys) out[k] = obj?.[k];
  return out;
}
function stripUndefined(o: any) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
function redact(s: any) {
  const c = JSON.parse(JSON.stringify(s));
  if (c.finance?.paystackSecretKey) c.finance.paystackSecretKey = '***';
  return c;
}
