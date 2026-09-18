# Deployment

## Backend on Railway

1. **Create a project** → *Add PostgreSQL*. Railway injects `DATABASE_URL` into services that reference it.
2. **Add a service from the GitHub repository** and set **Root Directory** to `api`. `api/railway.json` tells Railway (Nixpacks) to build with `npm install --include=dev --no-audit --no-fund && npm run build` and start with `npm run start:prod`, which executes `prisma migrate deploy` before booting, so the schema (73 tables) and the Row-Level Security migration are applied automatically on first deploy.
   * `--include=dev` is required even though `NODE_ENV=production` is set at runtime — dev dependencies (`@nestjs/cli`, `typescript`) are needed to run `npm run build`, and npm skips them by default under `NODE_ENV=production`.
   * The build step deliberately uses `npm install`, **not** `npm ci`: Nixpacks already runs `npm ci` once in its own "install" phase (which, under `NODE_ENV=production`, installs only production dependencies). `npm ci` always deletes `node_modules` before reinstalling, so running it a *second* time in the "build" phase (our `buildCommand`) raced against that first phase's leftover `node_modules/.cache` and failed with `EBUSY: resource busy or locked, rmdir '/app/node_modules/.cache'`. `npm install` never deletes `node_modules` — it just adds the missing dev dependencies on top of what's already installed — so the two phases no longer conflict. Verified locally by simulating both phases back to back. If you ever see that `EBUSY` error again, check that `buildCommand` in `railway.json` still says `npm install`, not `npm ci`.
3. **Variables** (see `api/.env.example`):
   * `DATABASE_URL` (reference the Postgres plugin), `DATABASE_SSL=true` only if you use the public proxy URL.
   * `JWT_SECRET`, `JWT_REFRESH_SECRET` — long random strings (`openssl rand -hex 48`).
   * `NODE_ENV=production`, `PORT` (Railway sets it), `ROOT_DOMAIN=yourdomain.com`, `WEB_APP_URL=https://yourdomain.com`.
   * `CORS_ORIGINS=https://yourdomain.com,https://*.yourdomain.com,https://*.vercel.app`.
   * `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD` — the first platform owner (created on boot if missing).
   * Optional integrations: `PAYSTACK_SECRET_KEY`, `SMS_PROVIDER=ARKESEL` + `SMS_API_KEY` + `SMS_SENDER_ID`, `EMAIL_PROVIDER=SMTP` + `SMTP_HOST/PORT/USER/PASS/FROM`, `PLATFORM_AUTO_APPROVE=true` to skip manual school approval, `PLATFORM_BANK_DETAILS`.
   * `DEMO_MODE=false` hides the *Quick demo access* buttons on the login pages once you go live (they only appear while the seeded demo school exists).
   * **Never** set `PRISMA_ENGINE=wasm` in production.
4. **Networking** → *Generate domain* (or attach `api.yourdomain.com`). Health check path: `/health`.
5. **Demo data** (optional): `railway run npm run seed` inside `api/`, or run the seed locally against the Railway `DATABASE_URL`.
6. **Logs**: every request logs `requestId`, tenant and duration; errors include the request id that is also returned to the client.

## Frontend on Vercel

1. Import the repository; set **Root Directory** to `web` (Next.js is auto-detected).
2. Environment variables: `NEXT_PUBLIC_API_URL=https://<api-domain>/api/v1`, `NEXT_PUBLIC_ROOT_DOMAIN=yourdomain.com`.
3. **Domains**: add `yourdomain.com` and the wildcard `*.yourdomain.com`. Vercel issues certificates for the wildcard; every school then resolves at `<slug>.yourdomain.com` without any further configuration.
4. **Custom school domains** (Enterprise plan): the school adds `portal.theirschool.edu.gh` under Settings → Domains, creates the TXT record shown, clicks *Check DNS*; the platform team then adds the same domain to the Vercel project (Vercel → Domains) so a certificate is issued. The middleware maps the host to the school via `GET /public/tenant-by-host`.

## Payment provider (Paystack)

* Platform-wide key in `PAYSTACK_SECRET_KEY`, or per-school keys stored encrypted from Settings → Rules → Finance.
* Webhook URL: `https://<api-domain>/api/v1/public/webhooks/paystack` (HMAC-SHA512 verified against the key that initiated the transaction).
* Parents pay from the portal (fees or wallet top-ups); receipts are issued automatically on webhook confirmation.

## Local development (macOS, PostgreSQL 18)

```zsh
/Library/PostgreSQL/18/bin/psql -U postgres -h localhost -c "CREATE DATABASE schoolos;"
cd api && cp .env.example .env && npm install && npx prisma generate && npx prisma migrate deploy && npm run seed && npm run start:dev
cd web && cp .env.example .env.local && npm install && npm run dev
```

`npm run smoke` (in `api/`, API running) executes 222 end-to-end checks; `npm test` runs the unit tests.

## Upgrades

* Schema changes: edit `prisma/schema.prisma`, run `npx prisma migrate dev --name <change>` locally (generates a migration folder), commit; Railway applies it on deploy. Because RLS is enabled with `FORCE`, new tenant tables need a policy — see `prisma/migrations/20260915000001_rls/migration.sql` for the pattern (or re-run `node scripts/gen-migration.js` to regenerate both migrations for a fresh database).
* The frontend and backend are independently deployable; the API is versioned under `/api/v1`.

## Backups

* Railway PostgreSQL snapshots (platform level).
* Every school can download its own complete data (Settings → Data & backup) and the platform can download any school (Platform → School → Data & backup). See `DATA-OWNERSHIP.md`.
