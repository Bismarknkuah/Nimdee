# Data ownership & backups

**Each school owns its data.** At any time a school administrator (permission `SCHOOL_MANAGE`) can download everything the school has stored, and the platform team can produce the same export for any school (for support, migration or disaster recovery). Both are audited.

## What a school can download

Settings → **Data & backup**:

| Format | Endpoint | Contents |
|---|---|---|
| Complete backup (ZIP) | `GET /data/export.zip?format=ALL` | `manifest.json`, `school.json`, `json/<Table>.json`, `csv/<Table>.csv`, `restore.sql`, `README.txt` |
| JSON only | `GET /data/export.zip?format=JSON` | one JSON array per table |
| CSV only | `GET /data/export.zip?format=CSV` | one spreadsheet per table (UTF-8 BOM, opens in Excel) |
| SQL only | `GET /data/export.zip?format=SQL` | `INSERT … ON CONFLICT DO NOTHING` statements in dependency order |

`GET /data/summary` lists the tables and record counts that will be included; `GET /data/exports` lists previous downloads (who, when, size). The platform equivalents are `GET /platform/schools/:id/data-summary` and `GET /platform/schools/:id/export.zip`.

## Guarantees

* Exports run under the school's tenant scope, so Row-Level Security guarantees the archive can only ever contain that school's rows.
* Tables are ordered parents-first (tenant, roles, users, academic structure, people, then transactional data) so the SQL restores without foreign-key errors.
* Never exported: password hashes, refresh/session tokens, password-reset tokens, sync operation payloads, payment gateway keys.
* Money columns are plain decimals in the school currency; dates are ISO-8601 UTC.
* Every export writes a `DataExport` record (format, file name, tables, rows, bytes, duration, requester) and an audit entry `DATA_EXPORT_DOWNLOADED`.

## Restoring

1. Deploy a fresh School OS database (`prisma migrate deploy`).
2. Run `restore.sql` with `psql` as a superuser (it wraps everything in a transaction and inserts the tenant row first).
3. Users keep their emails but have no passwords (hashes are not exported); reset them from Users & roles.

## Leaving the platform

Because the SQL and CSV formats are open, a school can move to any other system: the CSVs map one-to-one to the tables documented in `ERD.md`.
