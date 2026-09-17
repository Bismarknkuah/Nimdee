'use client';
import { useEffect, useRef, useState } from 'react';
import { MessageSquarePlus, Send } from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useAcademic, classOptions } from '@/lib/academic';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { ago, fmtDateTime } from '@/lib/format';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Textarea,
  useToast,
} from '@/components/ui';

/** In-app messaging between parents, teachers and staff (direct, group and whole-class threads). */
export default function MessagesPage() {
  const toast = useToast();
  const { me, role, can } = useAuth();
  const { classes } = useAcademic();
  const { data: threads, loading, reload } = useApi<any[]>('/messages/threads');
  const [sel, setSel] = useState<string | null>(null);
  const { data: thread, reload: reloadThread } = useApi(sel ? `/messages/threads/${sel}` : null, [sel]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const { data: contacts } = useApi<any[]>(open ? '/messages/contacts' : null, [open]);
  const [f, setF] = useState<any>({ mode: 'DIRECT', participantIds: [], classId: '', subject: '', body: '' });
  const [filter, setFilter] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages?.length]);
  useEffect(() => {
    const t = setInterval(() => {
      reload();
      if (sel) reloadThread();
    }, 20_000);
    return () => clearInterval(t);
  }, [sel, reload, reloadThread]);

  const send = async () => {
    if (!body.trim() || !sel) return;
    setBusy(true);
    try {
      await api.post(`/messages/threads/${sel}`, { body });
      setBody('');
      reloadThread();
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const start = async () => {
    setBusy(true);
    try {
      const t = await api.post('/messages/threads', {
        type: f.mode === 'CLASS' ? 'CLASS' : f.participantIds.length > 1 ? 'GROUP' : 'DIRECT',
        participantIds: f.mode === 'CLASS' ? undefined : f.participantIds,
        classId: f.mode === 'CLASS' ? f.classId : undefined,
        subject: f.subject || undefined,
        body: f.body,
      });
      setOpen(false);
      setF({ mode: 'DIRECT', participantIds: [], classId: '', subject: '', body: '' });
      reload();
      setSel(t.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: string) =>
    setF({
      ...f,
      participantIds: f.participantIds.includes(id)
        ? f.participantIds.filter((x: string) => x !== id)
        : [...f.participantIds, id],
    });
  const canClass =
    role !== 'parent' && role !== 'student' && can('ANNOUNCEMENT_MANAGE', 'ACADEMIC_MANAGE', 'ATTENDANCE_MARK');
  const visibleContacts = (contacts ?? []).filter(
    (c) =>
      !filter ||
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      (c.note ?? '').toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <div>
      <PageHeader
        title="Messages"
        subtitle={
          role === 'parent'
            ? "Talk to your children's teachers and the school office"
            : 'Conversations with parents, students and colleagues'
        }
        actions={
          <Button onClick={() => setOpen(true)}>
            <MessageSquarePlus size={16} /> New conversation
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card padded={false} className="max-h-[70vh] overflow-y-auto">
          {loading ? (
            <Spinner />
          ) : threads?.length ? (
            <ul className="divide-y divide-slate-100">
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setSel(t.id)}
                    className={clsx(
                      'flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-slate-50',
                      sel === t.id && 'bg-brand-soft/50',
                    )}
                  >
                    <Avatar name={t.participants[0]?.name ?? t.subject ?? 'Group'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={clsx(
                            'truncate text-sm',
                            t.unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700',
                          )}
                        >
                          {t.type === 'CLASS'
                            ? (t.subject ?? 'Class')
                            : t.participants.map((p: any) => p.name).join(', ') || 'You'}
                        </p>
                        <span className="shrink-0 text-[11px] text-slate-400">{ago(t.lastMessageAt)}</span>
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {t.lastMessage
                          ? `${t.lastMessage.senderId === me?.user.id ? 'You: ' : ''}${t.lastMessage.body}`
                          : ''}
                      </p>
                    </div>
                    {t.unread > 0 && (
                      <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">{t.unread}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No conversations yet" description="Start one with the button above." />
          )}
        </Card>
        <Card padded={false} className="flex max-h-[70vh] min-h-[420px] flex-col lg:col-span-2">
          {thread ? (
            <>
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="font-semibold">
                  {thread.type === 'CLASS'
                    ? (thread.subject ?? 'Class conversation')
                    : thread.participants
                        .filter((p: any) => p.id !== me?.user.id)
                        .map((p: any) => p.name)
                        .join(', ')}
                </p>
                <p className="text-xs text-slate-500">
                  {thread.participants.length} participant(s) <Badge tone="slate">{thread.type}</Badge>
                </p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {thread.messages.map((m: any) => (
                  <div key={m.id} className={clsx('flex', m.mine ? 'justify-end' : 'justify-start')}>
                    <div
                      className={clsx(
                        'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm',
                        m.mine ? 'bg-brand text-white' : 'bg-slate-100 text-slate-800',
                      )}
                    >
                      {!m.mine && <p className="mb-0.5 text-[11px] font-semibold opacity-70">{m.sender.name}</p>}
                      <p className="whitespace-pre-line">{m.body}</p>
                      <p className={clsx('mt-1 text-[10px]', m.mine ? 'text-white/70' : 'text-slate-400')}>
                        {fmtDateTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottom} />
              </div>
              <div className="flex gap-2 border-t border-slate-100 p-3">
                <Textarea
                  className="min-h-[44px] flex-1"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write a message…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <Button onClick={send} loading={busy} disabled={!body.trim()}>
                  <Send size={16} />
                </Button>
              </div>
            </>
          ) : (
            <EmptyState title="Select a conversation" description="Messages are private to the people in the thread." />
          )}
        </Card>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New conversation"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={start}
              loading={busy}
              disabled={!f.body || (f.mode === 'CLASS' ? !f.classId : !f.participantIds.length)}
            >
              Send
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {canClass && (
            <Field label="Send to">
              <Select
                value={f.mode}
                onChange={(e) => setF({ ...f, mode: e.target.value, participantIds: [] })}
                options={[
                  { value: 'DIRECT', label: 'Specific people' },
                  { value: 'CLASS', label: 'All parents of a class' },
                ]}
              />
            </Field>
          )}
          {f.mode === 'CLASS' ? (
            <Field label="Class">
              <Select
                value={f.classId}
                onChange={(e) => setF({ ...f, classId: e.target.value })}
                placeholder="Select"
                options={classOptions(classes)}
              />
            </Field>
          ) : (
            <Field label={`Recipients${f.participantIds.length ? ` (${f.participantIds.length} selected)` : ''}`}>
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name…" />
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {visibleContacts.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50"
                  >
                    <input type="checkbox" checked={f.participantIds.includes(c.id)} onChange={() => toggle(c.id)} />
                    <Avatar name={c.name} src={c.avatarUrl} size="sm" />
                    <span className="flex-1">
                      {c.name}{' '}
                      <span className="text-xs text-slate-500">
                        · {c.userType === 'PARENT' ? `Parent of ${c.note ?? ''}` : c.userType.toLowerCase()}
                      </span>
                    </span>
                  </label>
                ))}
                {contacts && !visibleContacts.length && (
                  <p className="px-2 py-3 text-sm text-slate-500">No contacts match.</p>
                )}
              </div>
            </Field>
          )}
          {(f.mode === 'CLASS' || f.participantIds.length > 1) && (
            <Field label="Subject">
              <Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
            </Field>
          )}
          <Field label="Message">
            <Textarea className="min-h-[110px]" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
