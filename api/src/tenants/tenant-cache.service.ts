import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CORE_FEATURES } from '../common/features';
import { mergeSettings, SchoolSettings } from '../common/settings';

export interface TenantSnapshot {
  id: string;
  code: string;
  slug: string;
  name: string;
  status: string;
  currency: string;
  timezone: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  features: string[];
  studentLimit: number;
  planCode: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  settings: SchoolSettings;
}

const TTL_MS = 60_000;

/** Small in-memory cache of tenant status/plan/settings used by guards on every request. */
@Injectable()
export class TenantCacheService {
  private cache = new Map<string, { at: number; value: TenantSnapshot }>();
  constructor(private readonly prisma: PrismaService) {}

  invalidate(tenantId: string) {
    this.cache.delete(tenantId);
  }

  async get(tenantId: string): Promise<TenantSnapshot | null> {
    const hit = this.cache.get(tenantId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
    const t = await this.prisma.platform.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: { include: { plan: true } } },
    });
    if (!t) return null;
    const sub = t.subscription;
    const subUsable = sub && ['TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE'].includes(sub.status);
    const features = new Set<string>([
      ...CORE_FEATURES,
      ...(t.featureOverrides ?? []),
      ...(subUsable ? sub.plan.features : []),
    ]);
    for (const f of t.disabledFeatures ?? []) {
      if (!(CORE_FEATURES as string[]).includes(f)) features.delete(f);
    }
    const value: TenantSnapshot = {
      id: t.id,
      code: t.code,
      slug: t.slug,
      name: t.name,
      status: t.status,
      currency: t.currency,
      timezone: t.timezone,
      logoUrl: t.logoUrl,
      primaryColor: t.primaryColor,
      secondaryColor: t.secondaryColor,
      fontFamily: t.fontFamily,
      features: [...features],
      studentLimit: sub?.plan.studentLimit ?? 0,
      planCode: sub?.plan.code ?? null,
      planName: sub?.plan.name ?? null,
      subscriptionStatus: sub?.status ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      trialEndsAt: sub?.trialEndsAt ?? null,
      settings: mergeSettings(t.settings),
    };
    this.cache.set(tenantId, { at: Date.now(), value });
    return value;
  }

  async settings(tenantId: string): Promise<SchoolSettings> {
    const s = await this.get(tenantId);
    return s?.settings ?? mergeSettings({});
  }
}
