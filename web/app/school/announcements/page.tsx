'use client';
import { useState } from 'react';
import { Megaphone, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { useAcademic, classOptions } from '@/lib/academic';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, title } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';

export default function AnnouncementsPage() {
  const toast = useToast();
  const { me } = useAuth();
  const { classes } = useAcademic();
  const { data, loading, reload } = useApi<any[]>('/announcements');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({
    title: '',
    body: '',
    audienceType: 'ALL',
    classId: '',
    channels: ['IN_APP'],
    isPublic: false,
    publish: true,
  });
  const toggle = (c: string) =>
    setF({ ...f, channels: f.channels.includes(c) ? f.channels.filter((x: string) => x !== c) : [...f.channels, c] });
  const save = async () => {
    setBusy(true);
    try {
      const r = await api.post('/announcements', { ...f, classId: f.classId || undefined });
      toast.success(f.publish ? `Published to ${r.recipients} recipient(s)` : 'Draft saved');
      setOpen(false);
      setF({
        title: '',
        body: '',
        audienceType: 'ALL',
        classId: '',
        channels: ['IN_APP'],
        isPublic: false,
        publish: true,
      });
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const publish = async (id: string) => {
    try {
      const r = await api.post(`/announcements/${id}/publish`);
      toast.success(`Published to ${r.recipients} recipient(s)`);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/announcements/${id}`);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const sms = me?.tenant?.settings?.communication?.smsEnabled;
  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="In-app notifications, SMS and email to parents, staff and students"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Megaphone size={16} /> New announcement
          </Button>
        }
      />
      <DataTable
        rows={data}
        loading={loading}
        emptyTitle="No announcements yet"
        columns={[
          {
            key: 'title',
            header: 'Title',
            render: (a: any) => (
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="line-clamp-1 text-xs text-slate-500">{a.body}</p>
              </div>
            ),
          },
          {
            key: 'audienceType',
            header: 'Audience',
            render: (a: any) =>
              a.audienceType === 'CLASS'
                ? (classes.find((c) => c.id === a.classId)?.name ?? 'Class')
                : title(a.audienceType),
          },
          {
            key: 'channels',
            header: 'Channels',
            render: (a: any) =>
              a.channels.map((c: string) => (
                <Badge key={c} tone="slate" className="mr-1">
                  {c.replace('IN_APP', 'App')}
                </Badge>
              )),
          },
          {
            key: 'isPublic',
            header: 'Website',
            render: (a: any) => (a.isPublic ? <Badge tone="brand">Public</Badge> : '—'),
          },
          {
            key: 'publishedAt',
            header: 'Status',
            render: (a: any) =>
              a.publishedAt ? (
                <span className="text-xs text-slate-600">
                  Sent {fmtDateTime(a.publishedAt)} · {a.recipients} recipients
                </span>
              ) : (
                <Badge tone="amber">DRAFT</Badge>
              ),
          },
          {
            key: 'x',
            header: '',
            render: (a: any) => (
              <div className="flex gap-2 text-xs">
                {!a.publishedAt && (
                  <button className="flex items-center gap-1 text-brand hover:underline" onClick={() => publish(a.id)}>
                    <Send size={12} /> Publish
                  </button>
                )}
                <button className="text-red-600 hover:underline" onClick={() => remove(a.id)}>
                  Delete
                </button>
              </div>
            ),
          },
        ]}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New announcement"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy} disabled={!f.title || !f.body}>
              {f.publish ? 'Publish now' : 'Save draft'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Title">
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Message">
            <Textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="min-h-[140px]" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Audience">
              <Select
                value={f.audienceType}
                onChange={(e) => setF({ ...f, audienceType: e.target.value })}
                options={['ALL', 'PARENTS', 'TEACHERS', 'STAFF', 'STUDENTS', 'CLASS'].map((a) => ({
                  value: a,
                  label: a === 'ALL' ? 'Everyone' : title(a),
                }))}
              />
            </Field>
            {f.audienceType === 'CLASS' && (
              <Field label="Class">
                <Select
                  value={f.classId}
                  onChange={(e) => setF({ ...f, classId: e.target.value })}
                  placeholder="Select class"
                  options={classOptions(classes)}
                />
              </Field>
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            <Checkbox
              label="In-app notification"
              checked={f.channels.includes('IN_APP')}
              onChange={() => toggle('IN_APP')}
            />
            <Checkbox
              label={`SMS${sms === false ? ' (disabled in rules)' : ''}`}
              checked={f.channels.includes('SMS')}
              onChange={() => toggle('SMS')}
            />
            <Checkbox label="Email" checked={f.channels.includes('EMAIL')} onChange={() => toggle('EMAIL')} />
          </div>
          <div className="flex flex-wrap gap-4">
            <Checkbox
              label="Also show on the public website"
              checked={f.isPublic}
              onChange={(e) => setF({ ...f, isPublic: e.target.checked })}
            />
            <Checkbox
              label="Publish immediately"
              checked={f.publish}
              onChange={(e) => setF({ ...f, publish: e.target.checked })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
