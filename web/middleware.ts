import { NextResponse, type NextRequest } from 'next/server';

const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000').toLowerCase().split(':')[0];
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

/** Maps school subdomains and custom domains to the right school: <slug>.<root>/ → /site/<slug>. */
export async function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').toLowerCase().split(':')[0];
  const { pathname } = req.nextUrl;
  if (host === ROOT || host === `www.${ROOT}` || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host))
    return NextResponse.next();
  let slug: string | null = null;
  if (host.endsWith(`.${ROOT}`)) {
    const label =
      host
        .slice(0, -(ROOT.length + 1))
        .split('.')
        .pop() ?? '';
    if (!['www', 'app', 'api'].includes(label)) slug = label;
  } else {
    slug = req.cookies.get('schoolos.slug')?.value ?? null;
    if (!slug) {
      try {
        const r = await fetch(`${API}/public/resolve-host?host=${encodeURIComponent(host)}`, {
          next: { revalidate: 300 },
        } as any);
        const j = await r.json();
        if (j.found) slug = j.tenant.slug;
      } catch {
        /* API unreachable */
      }
    }
  }
  if (!slug) return NextResponse.next();
  const res =
    pathname === '/'
      ? NextResponse.rewrite(new URL(`/site/${slug}`, req.url))
      : pathname === '/apply'
        ? NextResponse.rewrite(new URL(`/site/${slug}/apply`, req.url))
        : NextResponse.next();
  res.cookies.set('schoolos.slug', slug, { path: '/', sameSite: 'lax' });
  return res;
}
export const config = { matcher: ['/((?!_next|api|sw.js|manifest.json|icon.svg|favicon.ico).*)'] };
