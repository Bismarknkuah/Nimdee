# School OS Web (Next.js 14 · Tailwind)

## Commands
`npm run dev` · `npm run build` · `npm start` · `npm run typecheck` · `npm run format`

## Environment (`.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000      # production: yourdomain.com
```

## Structure
* `app/page.tsx` landing · `app/login` · `app/register` (school onboarding wizard) · `app/platform/login`
* `app/site/[slug]` server-rendered school website (from the website builder) · `app/site/[slug]/apply` online admissions
* `app/school/dashboards/{admin,teacher,parent,student,finance,canteen}/page.tsx` — one dashboard per role; `/school` redirects to the right one
* `app/school/*` — students, guardians, staff, admissions, id-cards, academics, classes, attendance (offline-capable), results (assessments, marks, sheets), timetable, fees (invoices, structures, payments), canteen (POS, items, wallets), inventory, announcements, messages, events, assignments, discipline, library, transport, health, hr, reports, sync, website builder, users & roles, audit, settings (profile, branding, rules engine, domains, subscription, **data & backup**), portal (children, notifications)
* `app/platform/(console)/*` — overview, schools, school detail (approve/suspend/support session/billing/features/**data & backup**), plans, invoices, sync health, users, audit
* `middleware.ts` — maps `school.yourdomain.com` and verified custom domains to the school website (`/`, `/apply`) and remembers the school for login
* `lib/api.ts` fetch wrapper (bearer auth, refresh rotation, blob downloads) · `lib/auth.tsx` session, permissions, feature flags, branding CSS variables · `lib/offline.ts` IndexedDB queue + sync engine · `lib/types.ts` API response types · `components/ui/index.tsx` UI kit · `components/charts.tsx` · `public/sw.js` app-shell service worker

## Offline attendance
Teachers press **Download for offline** on the attendance screen. Marks saved while offline are queued in IndexedDB and pushed to `/sync/push` when the browser is back online (also every 90 s and from the header pill). Conflicts follow the school's rule (latest wins / server wins / manual). See `../docs/OFFLINE-SYNC.md`.
