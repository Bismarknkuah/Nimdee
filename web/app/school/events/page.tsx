'use client';
import { useState } from 'react';
import { CalendarPlus, MapPin } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useAcademic, classOptions } from '@/lib/academic';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime, title } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Modal,
  MonthCalendar,
  PageHeader,
  Select,
  Textarea,
  Timeline,
  useToast,
} from '@/components/ui';

/** School calendar: month grid with holidays, exams, meetings, trips; upcoming list; event editor. */
export default function EventsPage() {
  const toast = useToast();
  const { can, role } = useAuth();
  const { classes } = useAcademic();
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 });
  const [selected, setSelected] = useState<string | undefined>();
  const { data: cal, reload } = useApi(`/events/calendar${qs(ym)}`, [ym.year, ym.month]);
  const upcoming = useApi<any[]>('/events/upcoming');
  const { data: types } = useApi<string[]>('/events/types');
  const [modal, setModal] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({});
  const manage = can('EVENTS_MANAGE');
  const openNew = (date?: string) => {
    setF({
      title: '',
      description: '',
      type: 'MEETING',
      startAt: date ? `${date}T09:00` : '',
      endAt: '',
      allDay: false,
      location: '',
      audienceType: 'ALL',
      classId: '',
      isPublic: false,
      notify: true,
    });
    setModal({});
  };
  const openEdit = async (id: string) => {
    const e = await api.get(`/events/${id}`);
    setF({
      title: e.title,
      description: e.description ?? '',
      type: e.type,
      startAt: e.startAt.slice(0, 16),
      endAt: e.endAt.slice(0, 16),
      allDay: e.allDay,
      location: e.location ?? '',
      audienceType: e.audienceType,
      classId: e.classId ?? '',
      isPublic: e.isPublic,
      notify: false,
    });
    setModal(e);
  };
  const save = async () => {
    setBusy(true);
    try {
      const body = {
        ...f,
        startAt: new Date(f.startAt).toISOString(),
        endAt: f.endAt ? new Date(f.endAt).toISOString() : undefined,
        classId: f.classId || undefined,
        description: f.description || undefined,
        location: f.location || undefined,
      };
      if (modal.id) await api.patch(`/events/${modal.id}`, body);
      else await api.post('/events', body);
      toast.success('Event saved');
      setModal(null);
      reload();
      upcoming.reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!confirm('Delete this event?')) return;
    await api.delete(`/events/${modal.id}`);
    setModal(null);
    reload();
    upcoming.reload();
  };
  const dayEvents = selected ? (cal?.days?.[selected] ?? []) : [];
  return (
    <div>
      <PageHeader
        title="Calendar & events"
        subtitle="Holidays, exams, meetings, sports and trips — shared with the right audience"
        actions={
          manage && (
            <Button onClick={() => openNew(selected)}>
              <CalendarPlus size={16} /> New event
            </Button>
          )
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {cal ? (
            <MonthCalendar
              year={ym.year}
              month={ym.month}
              days={cal.days}
              selected={selected}
              onSelect={setSelected}
              onNavigate={(year, month) => {
                setYm({ year, month });
                setSelected(undefined);
              }}
            />
          ) : (
            <Card>Loading…</Card>
          )}
          {cal?.terms?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
              {cal.terms.map((t: any) => (
                <span key={t.id} className="rounded-full bg-slate-100 px-2 py-0.5">
                  {t.academicYear.name} {t.name}: {fmtDate(t.startDate)} – {fmtDate(t.endDate)}
                  {t.examStart ? ` · exams ${fmtDate(t.examStart)}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-4">
          {selected && (
            <Card
              title={fmtDate(selected)}
              actions={
                manage && (
                  <button className="text-xs text-brand hover:underline" onClick={() => openNew(selected)}>
                    Add
                  </button>
                )
              }
              padded={false}
            >
              <ul className="divide-y divide-slate-100 text-sm">
                {dayEvents.map((e: any) => (
                  <li
                    key={e.id}
                    className="cursor-pointer px-4 py-2 hover:bg-slate-50"
                    onClick={() => manage && openEdit(e.id)}
                  >
                    <p className="font-medium">
                      {e.title} <Badge tone="slate">{title(e.type)}</Badge>
                    </p>
                    <p className="text-xs text-slate-500">
                      {e.allDay
                        ? 'All day'
                        : `${new Date(e.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}–${new Date(e.endAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                      {e.location ? ` · ${e.location}` : ''}
                    </p>
                  </li>
                ))}
                {!dayEvents.length && <li className="px-4 py-4 text-slate-500">Nothing scheduled</li>}
              </ul>
            </Card>
          )}
          <Card title="Upcoming">
            <Timeline
              items={(upcoming.data ?? []).map((e) => ({
                id: e.id,
                title: (
                  <button className="text-left hover:underline" onClick={() => manage && openEdit(e.id)}>
                    {e.title}
                  </button>
                ),
                meta: (
                  <span className="flex items-center gap-1">
                    {e.allDay ? fmtDate(e.startAt) : fmtDateTime(e.startAt)}
                    {e.location && (
                      <>
                        <MapPin size={11} /> {e.location}
                      </>
                    )}
                  </span>
                ),
                tone:
                  { HOLIDAY: 'emerald', EXAM: 'red', MEETING: 'sky', SPORTS: 'amber', TRIP: 'violet' }[
                    e.type as string
                  ] ?? 'brand',
                body: e.description ? <span className="line-clamp-2">{e.description}</span> : undefined,
              }))}
            />
          </Card>
        </div>
      </div>
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? 'Edit event' : 'New event'}
        size="lg"
        footer={
          <>
            {modal?.id && (
              <Button variant="danger" onClick={remove}>
                Delete
              </Button>
            )}
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy} disabled={!f.title || !f.startAt}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2">
            <Input value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Type">
            <Select
              value={f.type}
              onChange={(e) => setF({ ...f, type: e.target.value })}
              options={(types ?? []).map((t) => ({ value: t, label: title(t) }))}
            />
          </Field>
          <Field label="Location">
            <Input value={f.location ?? ''} onChange={(e) => setF({ ...f, location: e.target.value })} />
          </Field>
          <Field label="Starts">
            <Input
              type="datetime-local"
              value={f.startAt ?? ''}
              onChange={(e) => setF({ ...f, startAt: e.target.value })}
            />
          </Field>
          <Field label="Ends">
            <Input
              type="datetime-local"
              value={f.endAt ?? ''}
              onChange={(e) => setF({ ...f, endAt: e.target.value })}
              disabled={f.allDay}
            />
          </Field>
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
                placeholder="Select"
                options={classOptions(classes)}
              />
            </Field>
          )}
          <Field label="Description" className="sm:col-span-2">
            <Textarea value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-4 sm:col-span-2">
            <Checkbox label="All day" checked={!!f.allDay} onChange={(e) => setF({ ...f, allDay: e.target.checked })} />
            <Checkbox
              label="Show on public website"
              checked={!!f.isPublic}
              onChange={(e) => setF({ ...f, isPublic: e.target.checked })}
            />
            <Checkbox
              label="Send in-app notification to the audience"
              checked={!!f.notify}
              onChange={(e) => setF({ ...f, notify: e.target.checked })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
