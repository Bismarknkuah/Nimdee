import { Injectable, OnModuleInit, OnModuleDestroy, ForbiddenException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ctx } from '../common/context/request-context';

/** node-postgres pool shared by the Prisma driver adapter (works identically on Railway and locally). */
export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

/**
 * Superusers (Railway's default `postgres` user) bypass RLS, so every pooled connection switches to the
 * non-superuser application role created by the RLS migration. Without it the policies would be inert.
 */
const APP_ROLE = process.env.DB_APP_ROLE || 'schoolos_app';
let roleWarned = false;
pgPool.on('connect', (client) => {
  if (process.env.DB_SKIP_SET_ROLE === 'true') return;
  client.query(`SET ROLE "${APP_ROLE}"`).catch((e) => {
    if (!roleWarned) {
      roleWarned = true;
      console.warn(
        `[prisma] Could not SET ROLE ${APP_ROLE} (${e.message}). Row-Level Security is NOT binding — run the migrations.`,
      );
    }
  });
});

/** The generated client entry: native engine in production; bundled WASM engine when PRISMA_ENGINE=wasm (sandboxed dev). */
const { PrismaClient: BasePrismaClient } = (
  process.env.PRISMA_ENGINE === 'wasm' ? require('@prisma/client/wasm') : require('@prisma/client')
) as typeof import('@prisma/client');

/**
 * Tenant isolation is enforced at two layers:
 *  1. PostgreSQL Row-Level Security policies on every tenant table (app.tenant_id / app.bypass_rls GUCs).
 *  2. Every query runs through a tenant-scoped client that sets those GUCs in the same transaction.
 * A query issued without tenant context returns zero rows — it can never leak another school's data.
 */
function tenantScoped(base: PrismaClient, tenantId: string) {
  return base.$extends({
    name: `tenant:${tenantId}`,
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await base.$transaction([
            base.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, TRUE), set_config('app.bypass_rls', 'off', TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

/** Platform-level client: bypasses RLS. Only used by platform admin & bootstrap code paths. */
function bypassScoped(base: PrismaClient) {
  return base.$extends({
    name: 'platform',
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await base.$transaction([
            base.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof tenantScoped>;
export type PlatformClient = ReturnType<typeof bypassScoped>;
export type Tx = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends BasePrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly tenantClients = new Map<string, TenantClient>();
  readonly platform: PlatformClient;

  constructor() {
    super({
      adapter: new PrismaPg(pgPool),
      log: process.env.PRISMA_LOG === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });
    this.platform = bypassScoped(this);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await pgPool.end().catch(() => undefined);
  }

  forTenant(tenantId: string): TenantClient {
    let client = this.tenantClients.get(tenantId);
    if (!client) {
      client = tenantScoped(this, tenantId);
      this.tenantClients.set(tenantId, client);
      if (this.tenantClients.size > 1000) {
        const oldest = this.tenantClients.keys().next().value;
        this.tenantClients.delete(oldest);
      }
    }
    return client;
  }

  /** Tenant-scoped client for the current request (RLS-enforced). */
  get db(): TenantClient {
    const t = ctx().tenantId;
    if (!t) throw new ForbiddenException('Tenant context is required');
    return this.forTenant(t);
  }

  /** Interactive transaction scoped to a tenant (RLS applies to every statement inside). */
  async tenantTx<T>(fn: (tx: Tx) => Promise<T>, tenantId?: string): Promise<T> {
    const t = tenantId ?? ctx().tenantId;
    if (!t) throw new ForbiddenException('Tenant context is required');
    return this.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${t}, TRUE), set_config('app.bypass_rls', 'off', TRUE)`;
        return fn(tx);
      },
      { maxWait: 10_000, timeout: 60_000 },
    );
  }

  /** Interactive transaction with RLS bypassed (platform operations, onboarding, webhooks). */
  async platformTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
        return fn(tx);
      },
      { maxWait: 10_000, timeout: 60_000 },
    );
  }
}
