/* eslint-disable */
/**
 * Generates the initial SQL migration and the RLS migration from prisma/schema.prisma.
 * Mirrors Prisma's PostgreSQL conventions (table/constraint/index naming, types, defaults) so the
 * result is byte-for-byte compatible with what `prisma migrate dev` would produce.
 * Usage: node scripts/gen-migration.js
 */
const fs = require('fs');
const path = require('path');
const { Prisma } = require('@prisma/client');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');
const dm = Prisma.dmmf.datamodel;

// ── parse attributes Prisma's runtime DMMF does not expose (native types, onDelete, @@index)
const modelBlocks = {};
for (const m of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) modelBlocks[m[1]] = m[2];
function fieldMeta(model, field) {
  const block = modelBlocks[model] || '';
  const line = block.split('\n').find((l) => l.trim().startsWith(field + ' '));
  const meta = { native: null, nativeArgs: [], onDelete: null };
  if (!line) return meta;
  const nt = /@db\.(\w+)(?:\(([^)]*)\))?/.exec(line);
  if (nt) {
    meta.native = nt[1];
    meta.nativeArgs = nt[2] ? nt[2].split(',').map((s) => s.trim()) : [];
  }
  const od = /onDelete:\s*(\w+)/.exec(line);
  if (od) meta.onDelete = od[1];
  return meta;
}
function indexesOf(model) {
  const block = modelBlocks[model] || '';
  return [...block.matchAll(/@@index\(\[([^\]]*)\]\)/g)].map((m) => m[1].split(',').map((s) => s.trim()));
}

function sqlType(f, meta) {
  let t;
  switch (f.kind) {
    case 'enum':
      t = `"${f.type}"`;
      break;
    default:
      switch (f.type) {
        case 'String':
          t = 'TEXT';
          break;
        case 'Int':
          t = 'INTEGER';
          break;
        case 'BigInt':
          t = 'BIGINT';
          break;
        case 'Float':
          t = 'DOUBLE PRECISION';
          break;
        case 'Boolean':
          t = 'BOOLEAN';
          break;
        case 'Json':
          t = 'JSONB';
          break;
        case 'Decimal':
          t = meta.native === 'Decimal' ? `DECIMAL(${meta.nativeArgs.join(',')})` : 'DECIMAL(65,30)';
          break;
        case 'DateTime':
          t = meta.native === 'Date' ? 'DATE' : 'TIMESTAMP(3)';
          break;
        default:
          throw new Error(`Unsupported type ${f.type}`);
      }
  }
  return f.isList ? `${t}[]` : t;
}
function sqlDefault(f) {
  if (!f.hasDefaultValue) return '';
  const d = f.default;
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    if (d.name === 'now') return ' DEFAULT CURRENT_TIMESTAMP';
    if (d.name === 'autoincrement') return '';
    return ''; // uuid(), cuid() etc. are generated client-side
  }
  if (typeof d === 'number') return ` DEFAULT ${d}`;
  if (typeof d === 'boolean') return ` DEFAULT ${d}`;
  if (typeof d === 'string') return ` DEFAULT '${d.replace(/'/g, "''")}'`;
  return '';
}

const out = [];
for (const e of dm.enums)
  out.push(`-- CreateEnum\nCREATE TYPE "${e.name}" AS ENUM (${e.values.map((v) => `'${v.name}'`).join(', ')});\n`);

const fks = [];
const indexes = [];
for (const m of dm.models) {
  const cols = [];
  for (const f of m.fields) {
    if (f.kind === 'object') {
      if (f.relationFromFields && f.relationFromFields.length) {
        const meta = fieldMeta(m.name, f.name);
        const from = f.relationFromFields;
        const optional = m.fields.filter((x) => from.includes(x.name)).some((x) => !x.isRequired);
        const onDelete = meta.onDelete
          ? meta.onDelete.toUpperCase().replace('SETNULL', 'SET NULL')
          : optional
            ? 'SET NULL'
            : 'RESTRICT';
        fks.push(
          `-- AddForeignKey\nALTER TABLE "${m.name}" ADD CONSTRAINT "${m.name}_${from.join('_')}_fkey" FOREIGN KEY (${from.map((c) => `"${c}"`).join(', ')}) REFERENCES "${f.type}"(${f.relationToFields.map((c) => `"${c}"`).join(', ')}) ON DELETE ${onDelete} ON UPDATE CASCADE;\n`,
        );
      }
      continue;
    }
    const meta = fieldMeta(m.name, f.name);
    const notNull = f.isRequired && !f.isList ? ' NOT NULL' : '';
    cols.push(`    "${f.name}" ${sqlType(f, meta)}${notNull}${sqlDefault(f)}`);
    if (f.isUnique)
      indexes.push(`-- CreateIndex\nCREATE UNIQUE INDEX "${m.name}_${f.name}_key" ON "${m.name}"("${f.name}");\n`);
  }
  const pkFields = m.primaryKey ? m.primaryKey.fields : m.fields.filter((f) => f.isId).map((f) => f.name);
  if (pkFields.length)
    cols.push(`\n    CONSTRAINT "${m.name}_pkey" PRIMARY KEY (${pkFields.map((c) => `"${c}"`).join(',')})`);
  out.push(`-- CreateTable\nCREATE TABLE "${m.name}" (\n${cols.join(',\n')}\n);\n`);
  for (const u of m.uniqueFields)
    indexes.push(
      `-- CreateIndex\nCREATE UNIQUE INDEX "${m.name}_${u.join('_')}_key" ON "${m.name}"(${u.map((c) => `"${c}"`).join(', ')});\n`,
    );
  for (const ix of indexesOf(m.name))
    indexes.push(
      `-- CreateIndex\nCREATE INDEX "${m.name}_${ix.join('_')}_idx" ON "${m.name}"(${ix.map((c) => `"${c}"`).join(', ')});\n`,
    );
}
out.push(...indexes, ...fks);

const migDir = path.join(__dirname, '..', 'prisma', 'migrations');
fs.mkdirSync(path.join(migDir, '20260915000000_init'), { recursive: true });
fs.writeFileSync(path.join(migDir, '20260915000000_init', 'migration.sql'), out.join('\n'));
fs.writeFileSync(
  path.join(migDir, 'migration_lock.toml'),
  '# Please do not edit this file manually\n# It should be added in your version-control system (i.e. Git)\nprovider = "postgresql"\n',
);

// ── RLS migration: every model with a tenantId column + the Tenant table itself
const rls = [
  '-- Row-Level Security: hard tenant isolation at the database layer.',
  '-- The application sets app.tenant_id (and app.bypass_rls=off) inside every transaction for school requests,',
  '-- and app.bypass_rls=on only for platform-owner operations. A connection with neither setting sees no tenant rows.',
  '',
];
const tenantTables = dm.models
  .filter((m) => m.fields.some((f) => f.name === 'tenantId' && f.kind === 'scalar'))
  .map((m) => m.name);
const policy = (col) =>
  `(current_setting('app.bypass_rls', true) = 'on' OR ${col} = current_setting('app.tenant_id', true))`;
for (const t of tenantTables) {
  rls.push(
    `ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "${t}" FORCE ROW LEVEL SECURITY;`,
    `CREATE POLICY "tenant_isolation" ON "${t}" USING ${policy('"tenantId"')} WITH CHECK ${policy('"tenantId"')};`,
    '',
  );
}
rls.push(
  `ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;`,
  `CREATE POLICY "tenant_isolation" ON "Tenant" USING ${policy('"id"')} WITH CHECK ${policy('"id"')};`,
  '',
);
rls.push(
  `-- Application role. Superusers bypass RLS, so the API switches to this non-superuser role on every`,
  `-- pooled connection (SET ROLE schoolos_app) which makes the policies above binding.`,
  `DO $$ BEGIN`,
  `  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'schoolos_app') THEN CREATE ROLE schoolos_app NOLOGIN NOBYPASSRLS; END IF;`,
  `EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'Could not create role schoolos_app; RLS will rely on application scoping only';`,
  `END $$;`,
  `GRANT USAGE ON SCHEMA public TO schoolos_app;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO schoolos_app;`,
  `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO schoolos_app;`,
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO schoolos_app;`,
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO schoolos_app;`,
  `GRANT schoolos_app TO CURRENT_USER;`,
  '',
);
fs.mkdirSync(path.join(migDir, '20260915000001_rls'), { recursive: true });
fs.writeFileSync(path.join(migDir, '20260915000001_rls', 'migration.sql'), rls.join('\n'));
console.log(`init migration: ${out.length} statements; RLS on ${tenantTables.length + 1} tables`);
