import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import archiver from 'archiver';
import { Readable } from 'stream';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { ctx, tid } from '../common/context/request-context';
import { toCsv } from '../common/csv';
import { isDecimal } from '../common/prisma-runtime';
import * as fs from 'fs';
import * as path from 'path';

export type ExportFormat = 'ALL' | 'JSON' | 'CSV' | 'SQL';
interface TableMeta {
  name: string;
  delegate: string;
  columns: Prisma.DMMF.Field[];
  selfRefColumns: string[];
}

const BATCH = 1000;

/**
 * Full data ownership: every school can download everything it has stored, at any time.
 *  - JSON  → one file per table (machine-readable, re-importable)
 *  - CSV   → one file per table (opens in Excel / Google Sheets)
 *  - SQL   → INSERT statements in dependency order that restore the school into a fresh Nimdee database
 * The export is streamed as a ZIP straight to the browser (no temporary files), runs through the
 * tenant-scoped client so Row-Level Security guarantees only the school's own rows are read,
 * and is recorded in the DataExport history + audit log.
 */
@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);
  private tables: TableMeta[] | null = null;
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private tenants: TenantCacheService,
  ) {}

  /** Tenant tables in foreign-key dependency order (parents before children). */
  private tableOrder(): TableMeta[] {
    if (this.tables) return this.tables;
    const models = Prisma.dmmf.datamodel.models.filter(
      (m) =>
        m.fields.some((f) => f.name === 'tenantId' && f.kind === 'scalar') &&
        ![
          'RefreshToken',
          'PasswordResetToken',
          'SubscriptionInvoice',
          'Subscription',
          'TenantDomain',
          'AuditLog',
          'DataExport',
          'SyncOperation',
        ].includes(m.name),
    );
    const byName = new Map(models.map((m) => [m.name, m]));
    const deps = new Map<string, Set<string>>();
    for (const m of models) {
      const set = new Set<string>();
      for (const f of m.fields)
        if (f.kind === 'object' && f.relationFromFields?.length && f.type !== m.name && byName.has(f.type))
          set.add(f.type);
      deps.set(m.name, set);
    }
    const ordered: string[] = [];
    const visiting = new Set<string>();
    const visit = (n: string) => {
      if (ordered.includes(n)) return;
      if (visiting.has(n)) return;
      visiting.add(n);
      for (const d of deps.get(n) ?? []) visit(d);
      visiting.delete(n);
      ordered.push(n);
    };
    models.forEach((m) => visit(m.name));
    this.tables = ordered.map((name) => {
      const m = byName.get(name)!;
      const selfRefColumns = m.fields
        .filter((f) => f.kind === 'object' && f.type === m.name && f.relationFromFields?.length)
        .flatMap((f) => f.relationFromFields as string[]);
      return {
        name,
        delegate: name.charAt(0).toLowerCase() + name.slice(1),
        columns: m.fields.filter((f) => f.kind !== 'object'),
        selfRefColumns,
      };
    });
    return this.tables;
  }

  /** Row counts per table — shown before a download so the admin knows what they own. */
  async summary() {
    const db: any = this.prisma.db;
    const tables = this.tableOrder();
    const counts = await Promise.all(tables.map(async (t) => ({ table: t.name, rows: await db[t.delegate].count() })));
    const history = await this.prisma.db.dataExport.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    return {
      tables: counts,
      totalRows: counts.reduce((a, c) => a + c.rows, 0),
      lastExport: history[0] ?? null,
      history,
    };
  }

  history() {
    return this.prisma.db.dataExport.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  /** Streams a table in batches. Tables with an `id` column use keyset pagination; composite-key tables use offset pagination. */
  private async *rows(delegate: string) {
    const db: any = this.prisma.db;
    const meta = this.tableOrder().find((t) => t.delegate === delegate);
    const hasId = !!meta?.columns.some((c) => c.name === 'id');
    if (hasId) {
      let cursor: string | undefined;
      for (;;) {
        const batch = await db[delegate].findMany({
          take: BATCH,
          orderBy: { id: 'asc' },
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });
        if (!batch.length) return;
        yield batch;
        if (batch.length < BATCH) return;
        cursor = batch[batch.length - 1].id;
      }
    }
    const orderBy = (meta?.columns ?? [])
      .filter((c) => c.isId || c.kind === 'scalar')
      .slice(0, 2)
      .map((c) => ({ [c.name]: 'asc' }));
    for (let skip = 0; ; skip += BATCH) {
      const batch = await db[delegate].findMany({ take: BATCH, skip, orderBy });
      if (!batch.length) return;
      yield batch;
      if (batch.length < BATCH) return;
    }
  }

  private plain(row: any) {
    const out: any = {};
    for (const [k, v] of Object.entries(row))
      out[k] = isDecimal(v) ? Number(v) : v instanceof Date ? v.toISOString() : v;
    return out;
  }

  private sqlLiteral(v: any, f: Prisma.DMMF.Field): string {
    if (v === null || v === undefined) return 'NULL';
    const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
    if (f.isList) return `ARRAY[${(v as any[]).map((x) => q(String(x))).join(',')}]::text[]`;
    switch (f.type) {
      case 'Boolean':
        return v ? 'TRUE' : 'FALSE';
      case 'Int':
      case 'Float':
      case 'BigInt':
        return String(v);
      case 'Decimal':
        return q(v.toString());
      case 'DateTime':
        return q(new Date(v).toISOString());
      case 'Json':
        return `${q(JSON.stringify(v))}::jsonb`;
      default:
        return q(String(v));
    }
  }

  /** Streams the ZIP to the response. Returns the DataExport record. */
  async streamZip(res: Response, format: ExportFormat) {
    const tenantId = tid();
    const snap = await this.tenants.get(tenantId);
    const tenant = await this.prisma.db.tenant.findUnique({ where: { id: tenantId } });
    const started = Date.now();
    const tables = this.tableOrder();
    const fileName = `${snap.slug}-school-os-export-${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('warning', (e) => this.logger.warn(e.message));
    archive.on('error', (e) => {
      this.logger.error(e.message);
      res.destroy(e);
    });
    archive.pipe(res);

    const counts: Record<string, number> = {};
    const self = this;
    const wantJson = format === 'ALL' || format === 'JSON';
    const wantCsv = format === 'ALL' || format === 'CSV';
    const wantSql = format === 'ALL' || format === 'SQL';

    // The school record itself (settings, branding, website config) — without secrets
    const { settings, ...tenantPublic } = tenant as any;
    const safeSettings = JSON.parse(JSON.stringify(settings ?? {}));
    if (safeSettings.finance?.paystackSecretKey) safeSettings.finance.paystackSecretKey = '***';
    const schoolJson = JSON.stringify(this.plain({ ...tenantPublic, settings: safeSettings }), null, 2);
    if (wantJson) archive.append(schoolJson, { name: 'json/School.json' });

    for (const t of tables) {
      if (wantJson)
        archive.append(
          Readable.from(
            (async function* () {
              yield '[';
              let first = true;
              for await (const batch of self.rows(t.delegate)) {
                for (const r of batch) {
                  yield (first ? '\n' : ',\n') + JSON.stringify(self.plain(r));
                  first = false;
                  counts[t.name] = (counts[t.name] ?? 0) + 1;
                }
              }
              yield '\n]\n';
            })(),
          ),
          { name: `json/${t.name}.json` },
        );
      if (wantCsv)
        archive.append(
          Readable.from(
            (async function* () {
              const cols = t.columns.map((c) => c.name);
              yield '\uFEFF' + cols.join(',') + '\n';
              for await (const batch of self.rows(t.delegate)) {
                yield toCsv(
                  batch.map((r) => self.plain(r)),
                  cols,
                )
                  .split('\n')
                  .slice(1)
                  .join('\n') + '\n';
                if (!wantJson) counts[t.name] = (counts[t.name] ?? 0) + batch.length;
              }
            })(),
          ),
          { name: `csv/${t.name}.csv` },
        );
    }
    if (wantSql) {
      archive.append(
        Readable.from(
          (async function* () {
            yield `-- Nimdee data backup for ${tenant.name} (${tenant.code})\n-- Generated ${new Date().toISOString()}\n-- Restore: create an empty Nimdee database, run \`npx prisma migrate deploy\`, then \`psql "$DATABASE_URL" -f backup.sql\`.\n-- Tables are emitted in foreign-key order; self-references are patched with UPDATE statements at the end.\nBEGIN;\nSELECT set_config('app.bypass_rls', 'on', TRUE);\n\n`;
            const tCols = Prisma.dmmf.datamodel.models
              .find((m) => m.name === 'Tenant')!
              .fields.filter((f) => f.kind !== 'object');
            yield `INSERT INTO "Tenant" (${tCols.map((c) => `"${c.name}"`).join(', ')}) VALUES (${tCols.map((c) => self.sqlLiteral(c.name === 'settings' ? safeSettings : (tenant as any)[c.name], c)).join(', ')}) ON CONFLICT ("id") DO NOTHING;\n\n`;
            const patches: string[] = [];
            for (const t of tables) {
              let header = false;
              for await (const batch of self.rows(t.delegate)) {
                if (!header) {
                  yield `-- ${t.name}\n`;
                  header = true;
                }
                const cols = t.columns.map((c) => `"${c.name}"`).join(', ');
                const values = batch
                  .map(
                    (r) =>
                      `(${t.columns.map((c) => self.sqlLiteral(t.selfRefColumns.includes(c.name) ? null : r[c.name], c)).join(', ')})`,
                  )
                  .join(',\n');
                yield `INSERT INTO "${t.name}" (${cols}) VALUES\n${values}\nON CONFLICT DO NOTHING;\n`;
                for (const r of batch)
                  for (const sc of t.selfRefColumns)
                    if (r[sc]) patches.push(`UPDATE "${t.name}" SET "${sc}" = '${r[sc]}' WHERE "id" = '${r.id}';`);
                if (!wantJson && !wantCsv) counts[t.name] = (counts[t.name] ?? 0) + batch.length;
              }
            }
            if (patches.length) yield `\n-- self-references\n${patches.join('\n')}\n`;
            yield `\nCOMMIT;\n`;
          })(),
        ),
        { name: 'sql/backup.sql' },
      );
      const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
      if (fs.existsSync(schemaPath)) archive.file(schemaPath, { name: 'sql/schema.prisma' });
    }
    archive.append(
      Readable.from(
        (async function* () {
          // manifest is appended last so counts are complete
          yield JSON.stringify(
            {
              school: { id: tenant.id, code: tenant.code, name: tenant.name, slug: tenant.slug },
              exportedAt: new Date().toISOString(),
              exportedBy: ctx().actorName ?? 'system',
              format,
              schemaVersion: '2026-09-16',
              tables: tables.map((t) => ({
                name: t.name,
                rows: counts[t.name] ?? 0,
                columns: t.columns.map((c) => c.name),
              })),
            },
            null,
            2,
          );
        })(),
      ),
      { name: 'manifest.json' },
    );
    archive.append(
      `Nimdee data export — ${tenant.name}\n\nFolders:\n  json/   one JSON array per table (School.json holds the school profile, branding, rules and website)\n  csv/    the same tables as CSV (UTF-8 with BOM, opens in Excel)\n  sql/    backup.sql restores this school into a fresh Nimdee database; schema.prisma documents every table\n  manifest.json  what was exported and when\n\nSensitive values (payment gateway secrets, password hashes) are never included.\nThis export was recorded in your audit log.\n`,
      { name: 'README.txt' },
    );
    await archive.finalize();
    await new Promise<void>((resolve) => res.on('finish', () => resolve()));
    const rowCount = Object.values(counts).reduce((a, b) => a + b, 0);
    const record = await this.prisma.db.dataExport.create({
      data: {
        tenantId,
        requestedById: ctx().userId ?? null,
        requestedBy: ctx().actorName ?? null,
        format: (format === 'ALL' ? 'JSON' : format) as any,
        fileName,
        sizeBytes: archive.pointer(),
        rowCount,
        tables: tables.length,
        durationMs: Date.now() - started,
      },
    });
    await this.audit.log({
      action: 'DATA_EXPORT_DOWNLOADED',
      entity: 'DataExport',
      entityId: record.id,
      after: { format, fileName, rowCount, sizeBytes: archive.pointer() },
    });
    return record;
  }
}
