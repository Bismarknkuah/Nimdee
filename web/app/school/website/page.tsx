'use client';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { title } from '@/lib/format';
import { portalUrlFor } from '@/lib/tenant';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  PageHeader,
  Spinner,
  Textarea,
  useToast,
} from '@/components/ui';

const SECTION_TYPES = [
  'hero',
  'about',
  'programs',
  'features',
  'stats',
  'message',
  'gallery',
  'testimonials',
  'news',
  'contact',
];

/** No-code website builder: reorder, enable and edit sections; publish. */
export default function WebsiteBuilder() {
  const toast = useToast();
  const { me } = useAuth();
  const { data, loading, reload } = useApi('/school/website');
  const [cfg, setCfg] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);
  useEffect(() => {
    if (data) setCfg(JSON.parse(JSON.stringify(data)));
  }, [data]);
  if (loading || !cfg) return <Spinner />;
  const sections: any[] = cfg.sections;
  const s = sections[sel];
  const setSection = (patch: any) =>
    setCfg({ ...cfg, sections: sections.map((x, i) => (i === sel ? { ...x, ...patch } : x)) });
  const setProp = (k: string, v: any) => setSection({ props: { ...s.props, [k]: v } });
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= sections.length) return;
    const arr = [...sections];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setCfg({ ...cfg, sections: arr });
    setSel(j);
  };
  const save = async (published?: boolean) => {
    setBusy(true);
    try {
      const { previewUrl, ...body } = cfg;
      await api.put('/school/website', { ...body, ...(published !== undefined ? { published } : {}) });
      toast.success(published ? 'Website published' : 'Saved');
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const items = (key: string, fields: string[]) => (
    <div className="space-y-2">
      {(s.props[key] ?? []).map((it: any, i: number) => (
        <div key={i} className="rounded-lg border border-slate-200 p-2">
          <div className="grid gap-2">
            {fields.map((f) => (
              <Input
                key={f}
                placeholder={title(f)}
                value={it[f] ?? ''}
                onChange={(e) =>
                  setProp(
                    key,
                    s.props[key].map((x: any, j: number) => (j === i ? { ...x, [f]: e.target.value } : x)),
                  )
                }
              />
            ))}
          </div>
          <button
            className="mt-1 text-xs text-red-600"
            onClick={() =>
              setProp(
                key,
                s.props[key].filter((_: any, j: number) => j !== i),
              )
            }
          >
            Remove
          </button>
        </div>
      ))}
      <Button variant="secondary" onClick={() => setProp(key, [...(s.props[key] ?? []), {}])}>
        <Plus size={14} /> Add
      </Button>
    </div>
  );
  const url = me?.tenant ? portalUrlFor(me.tenant.slug) : '';
  return (
    <div>
      <PageHeader
        title="Website builder"
        subtitle={
          <span>
            Your public site:{' '}
            <a href={url} target="_blank" className="text-brand hover:underline">
              {url}
            </a>{' '}
            {cfg.published ? <Badge tone="emerald">PUBLISHED</Badge> : <Badge tone="amber">DRAFT</Badge>}
          </span>
        }
        actions={
          <>
            <a href={`/site/${me?.tenant?.slug}`} target="_blank" className="btn-secondary">
              <ExternalLink size={16} /> Preview
            </a>
            <Button variant="secondary" onClick={() => save()} loading={busy}>
              Save draft
            </Button>
            <Button onClick={() => save(true)} loading={busy}>
              Publish
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Sections" padded={false}>
          <ul className="divide-y divide-slate-100">
            {sections.map((x, i) => (
              <li
                key={x.id}
                className={`flex items-center gap-2 px-3 py-2 text-sm ${i === sel ? 'bg-brand-soft' : ''}`}
              >
                <button className="flex-1 text-left" onClick={() => setSel(i)}>
                  {x.props?.title ?? title(x.type)} <span className="text-xs text-slate-400">{x.type}</span>
                </button>
                <button
                  onClick={() =>
                    setCfg({ ...cfg, sections: sections.map((y, j) => (j === i ? { ...y, enabled: !y.enabled } : y)) })
                  }
                  className="text-slate-500"
                >
                  {x.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button onClick={() => move(i, -1)} className="text-slate-400">
                  <ArrowUp size={14} />
                </button>
                <button onClick={() => move(i, 1)} className="text-slate-400">
                  <ArrowDown size={14} />
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 p-3">
            <Field label="Add section">
              <select
                className="input"
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  setCfg({
                    ...cfg,
                    sections: [
                      ...sections,
                      {
                        id: `${e.target.value}-${Date.now()}`,
                        type: e.target.value,
                        enabled: true,
                        props: { title: title(e.target.value), items: [] },
                      },
                    ],
                  });
                  setSel(sections.length);
                }}
              >
                <option value="">Choose type…</option>
                {SECTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {title(t)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>
        <Card
          title={s ? `${title(s.type)} section` : 'Select a section'}
          className="lg:col-span-2"
          actions={
            s && (
              <button
                className="text-xs text-red-600 hover:underline"
                onClick={() => {
                  setCfg({ ...cfg, sections: sections.filter((_, i) => i !== sel) });
                  setSel(0);
                }}
              >
                <Trash2 size={14} className="inline" /> Remove
              </button>
            )
          }
        >
          {s && (
            <div className="space-y-3">
              <Checkbox
                label="Show this section"
                checked={s.enabled}
                onChange={(e) => setSection({ enabled: e.target.checked })}
              />
              {s.type !== 'stats' && (
                <Field label="Title">
                  <Input value={s.props.title ?? ''} onChange={(e) => setProp('title', e.target.value)} />
                </Field>
              )}
              {s.type === 'hero' && (
                <>
                  <Field label="Subtitle">
                    <Input value={s.props.subtitle ?? ''} onChange={(e) => setProp('subtitle', e.target.value)} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Button label">
                      <Input value={s.props.ctaLabel ?? ''} onChange={(e) => setProp('ctaLabel', e.target.value)} />
                    </Field>
                    <Field label="Button link">
                      <Input
                        value={s.props.ctaHref ?? ''}
                        onChange={(e) => setProp('ctaHref', e.target.value)}
                        placeholder="/admissions"
                      />
                    </Field>
                  </div>
                </>
              )}
              {(s.type === 'about' || s.type === 'message') && (
                <>
                  <Field label="Text">
                    <Textarea
                      className="min-h-[160px]"
                      value={s.props.body ?? ''}
                      onChange={(e) => setProp('body', e.target.value)}
                    />
                  </Field>
                  {s.type === 'message' && (
                    <Field label="Signed by">
                      <Input value={s.props.name ?? ''} onChange={(e) => setProp('name', e.target.value)} />
                    </Field>
                  )}
                </>
              )}
              {(s.type === 'programs' || s.type === 'features') && items('items', ['title', 'body'])}
              {s.type === 'stats' && items('items', ['label', 'value'])}
              {s.type === 'testimonials' && items('items', ['name', 'body'])}
              {s.type === 'gallery' && (
                <Field label="Image URLs (one per line)">
                  <Textarea
                    value={(s.props.images ?? []).join('\n')}
                    onChange={(e) =>
                      setProp(
                        'images',
                        e.target.value
                          .split('\n')
                          .map((x) => x.trim())
                          .filter(Boolean),
                      )
                    }
                  />
                </Field>
              )}
              {s.type === 'news' && <Alert kind="info">Shows announcements marked “public” automatically.</Alert>}
              {s.type === 'contact' && (
                <Alert kind="info">Uses the address, phone, email and GPS location from Settings → Profile.</Alert>
              )}
            </div>
          )}
        </Card>
      </div>
      <Card title="Pages & footer" className="mt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Admissions page intro">
            <Textarea
              value={cfg.pages?.admissions?.body ?? ''}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  pages: { ...cfg.pages, admissions: { ...cfg.pages?.admissions, body: e.target.value } },
                })
              }
            />
          </Field>
          <Field label="Footer text">
            <Input
              value={cfg.footer?.text ?? ''}
              onChange={(e) => setCfg({ ...cfg, footer: { ...cfg.footer, text: e.target.value } })}
            />
          </Field>
        </div>
      </Card>
    </div>
  );
}
