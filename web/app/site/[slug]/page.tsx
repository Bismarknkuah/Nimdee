import { notFound } from 'next/navigation';
import { SchoolSite } from '@/components/SchoolSite';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
export const revalidate = 60;

async function load(slug: string) {
  const r = await fetch(`${API}/public/site/${slug}`, { next: { revalidate: 60 } });
  if (!r.ok) return null;
  return r.json();
}
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const d = await load(params.slug);
  return d
    ? {
        title: d.school.name,
        description: d.website?.sections?.[0]?.props?.subtitle,
        icons: d.school.faviconUrl ? [{ url: d.school.faviconUrl }] : undefined,
      }
    : { title: 'School not found' };
}
export default async function SiteHome({ params }: { params: { slug: string } }) {
  const data = await load(params.slug);
  if (!data) notFound();
  return <SchoolSite data={data} slug={params.slug} applyHref={`/site/${params.slug}/apply`} loginHref="/login" />;
}
