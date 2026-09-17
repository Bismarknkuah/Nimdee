/** Resolves which school (slug) the current host belongs to. Works for <slug>.<root> and for custom domains (via cookie set by middleware). */
export const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000').toLowerCase();

export function slugFromHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const h = host.toLowerCase();
  const root = ROOT_DOMAIN.split(':')[0];
  const hostname = h.split(':')[0];
  if (hostname === root || hostname === `www.${root}`) return null;
  if (hostname.endsWith(`.${root}`)) {
    const label = hostname
      .slice(0, -(root.length + 1))
      .split('.')
      .pop();
    return label && label !== 'www' && label !== 'app' && label !== 'api' ? label : null;
  }
  return null;
}

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.split('; ').find((c) => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.split('=')[1]) : null;
}

/** Slug for the school this browser is on: subdomain → middleware cookie → remembered login. */
export function currentSlug(): string | null {
  if (typeof window === 'undefined') return null;
  return slugFromHost(window.location.host) || readCookie('schoolos.slug') || localStorage.getItem('schoolos.slug');
}

export function portalUrlFor(slug: string) {
  const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https' : 'http';
  return `${proto}://${slug}.${ROOT_DOMAIN}`;
}
