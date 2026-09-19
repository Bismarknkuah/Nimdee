import Link from 'next/link';
import { fmtDate } from '@/lib/format';

/** Turns a YouTube or Vimeo link (any common format) into its embeddable iframe URL, or null if the
 *  link isn't recognised — video is embedded from these platforms rather than uploaded, since a raw
 *  video file is far too large to store the way an image can be. */
function toEmbedUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v') || u.pathname.split('/').pop();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Renders a school's public website from its website builder config (server component friendly). */
export function SchoolSite({
  data,
  slug,
  applyHref,
  loginHref,
}: {
  data: any;
  slug: string;
  applyHref: string;
  loginHref: string;
}) {
  const { school, website, news } = data;
  const sections: any[] = (website.sections ?? []).filter((s: any) => s.enabled);
  const brand = school.primaryColor || '#1d4ed8';
  const href = (h: string) =>
    h === '/admissions' ? applyHref : h === '/login' ? loginHref : h === '/' ? `/site/${slug}` : h;
  return (
    <div
      style={{
        ['--brand' as any]: brand,
        ['--brand-dark' as any]: brand,
        ['--brand-soft' as any]: brand + '22',
        fontFamily: school.fontFamily,
      }}
      className="min-h-screen bg-white text-slate-800"
    >
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            {school.logoUrl ? (
              <img src={school.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                style={{ background: brand }}
              >
                {school.name[0]}
              </div>
            )}
            <div>
              <p className="font-semibold leading-tight text-slate-900">{school.name}</p>
              {school.district && (
                <p className="text-xs text-slate-500">
                  {school.district}, {school.region}
                </p>
              )}
            </div>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            {(website.nav ?? []).map((n: any) => (
              <Link key={n.label} href={href(n.href)} className="rounded-md px-3 py-1.5 hover:bg-slate-100">
                {n.label}
              </Link>
            ))}
            <Link
              href={applyHref}
              className="ml-2 rounded-lg px-3.5 py-2 font-medium text-white"
              style={{ background: brand }}
            >
              Apply
            </Link>
          </nav>
        </div>
      </header>
      {sections.map((s) => {
        const p = s.props ?? {};
        switch (s.type) {
          case 'hero':
            return (
              <section
                key={s.id}
                className="px-5 py-20 text-center text-white"
                style={{ background: `linear-gradient(135deg, ${brand}, ${school.secondaryColor || '#0f172a'})` }}
              >
                <h1 className="mx-auto max-w-3xl text-4xl font-bold sm:text-5xl">{p.title}</h1>
                <p className="mx-auto mt-4 max-w-2xl text-lg opacity-90">{p.subtitle}</p>
                {p.ctaLabel && (
                  <Link
                    href={href(p.ctaHref || '/admissions')}
                    className="mt-8 inline-flex rounded-lg bg-white px-5 py-3 font-semibold"
                    style={{ color: brand }}
                  >
                    {p.ctaLabel}
                  </Link>
                )}
              </section>
            );
          case 'about':
          case 'message':
            return (
              <section key={s.id} className="mx-auto max-w-4xl px-5 py-14">
                <h2 className="text-2xl font-bold text-slate-900">{p.title}</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-600">{p.body}</p>
                {p.name && <p className="mt-3 font-medium text-slate-800">By {p.name}</p>}
              </section>
            );
          case 'programs':
          case 'features':
            return (
              <section key={s.id} className="bg-slate-50 py-14">
                <div className="mx-auto max-w-6xl px-5">
                  <h2 className="text-2xl font-bold text-slate-900">{p.title}</h2>
                  <div className="mt-6 grid gap-5 sm:grid-cols-3">
                    {(p.items ?? []).map((it: any, i: number) => (
                      <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
                        <h3 className="font-semibold text-slate-900">{it.title}</h3>
                        <p className="mt-1 text-sm text-slate-600">{it.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          case 'stats':
            return (
              <section key={s.id} className="py-12">
                <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-5 text-center sm:grid-cols-4">
                  {(p.items ?? []).map((it: any, i: number) => (
                    <div key={i}>
                      <p className="text-3xl font-bold" style={{ color: brand }}>
                        {it.value}
                      </p>
                      <p className="text-sm text-slate-500">{it.label}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          case 'gallery':
            return p.images?.length ? (
              <section key={s.id} className="mx-auto max-w-6xl px-5 py-14">
                <h2 className="text-2xl font-bold text-slate-900">{p.title}</h2>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {p.images.map((src: string, i: number) => (
                    <img key={i} src={src} alt="" className="aspect-square rounded-lg object-cover" />
                  ))}
                </div>
              </section>
            ) : null;
          case 'video': {
            const embedSrc = toEmbedUrl(p.url);
            return embedSrc ? (
              <section key={s.id} className="mx-auto max-w-4xl px-5 py-14">
                {p.title && <h2 className="mb-6 text-2xl font-bold text-slate-900">{p.title}</h2>}
                <div className="relative w-full overflow-hidden rounded-xl pt-[56.25%]">
                  <iframe
                    src={embedSrc}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </section>
            ) : null;
          }
          case 'testimonials':
            return p.items?.length ? (
              <section key={s.id} className="bg-slate-50 py-14">
                <div className="mx-auto max-w-6xl px-5">
                  <h2 className="text-2xl font-bold text-slate-900">{p.title}</h2>
                  <div className="mt-6 grid gap-5 sm:grid-cols-3">
                    {p.items.map((it: any, i: number) => (
                      <blockquote key={i} className="rounded-xl bg-white p-5 text-sm text-slate-600">
                        “{it.body}”<footer className="mt-3 font-medium text-slate-800">{it.name}</footer>
                      </blockquote>
                    ))}
                  </div>
                </div>
              </section>
            ) : null;
          case 'news':
            return news?.length ? (
              <section key={s.id} className="mx-auto max-w-6xl px-5 py-14">
                <h2 className="text-2xl font-bold text-slate-900">{p.title}</h2>
                <div className="mt-6 grid gap-5 sm:grid-cols-3">
                  {news.map((n: any) => (
                    <article key={n.id} className="rounded-xl border border-slate-200 p-5">
                      <p className="text-xs text-slate-500">{fmtDate(n.publishedAt)}</p>
                      <h3 className="mt-1 font-semibold text-slate-900">{n.title}</h3>
                      <p className="mt-1 line-clamp-4 text-sm text-slate-600">{n.body}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null;
          case 'contact':
            return (
              <section key={s.id} className="bg-slate-900 py-14 text-white">
                <div className="mx-auto max-w-6xl px-5">
                  <h2 className="text-2xl font-bold">{p.title}</h2>
                  <div className="mt-4 grid gap-6 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-slate-400">Address</p>
                      <p>{school.address ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Phone</p>
                      <p>{school.phone ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Email</p>
                      <p>{school.email ?? '—'}</p>
                    </div>
                  </div>
                  {school.gpsLat && (
                    <a
                      className="mt-4 inline-block text-sm underline"
                      href={`https://maps.google.com/?q=${school.gpsLat},${school.gpsLng}`}
                      target="_blank"
                    >
                      Open in Google Maps
                    </a>
                  )}
                </div>
              </section>
            );
          default:
            return null;
        }
      })}
      <footer className="border-t border-slate-100 px-5 py-6 text-center text-xs text-slate-500">
        {website.footer?.text} ·{' '}
        <Link href={loginHref} className="hover:underline">
          Staff & parent portal
        </Link>
      </footer>
    </div>
  );
}
