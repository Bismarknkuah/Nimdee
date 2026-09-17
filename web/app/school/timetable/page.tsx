'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, Printer } from 'lucide-react';
import { api, openBlob, qs } from '@/lib/api';
import { useAcademic, classOptions } from '@/lib/academic';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { DAYS } from '@/lib/format';
import { Alert, Button, Card, Field, Modal, PageHeader, Select, Spinner, Tabs, useToast } from '@/components/ui';

function Timetable() {
  const params = useSearchParams();
  const toast = useToast();
  const { can, role, me } = useAuth();
  const { classes } = useAcademic();
  const [view, setView] = useState(role === 'teacher' ? 'my' : 'class');
  const [classId, setClassId] = useState(params.get('classId') ?? '');
  const [teacherId, setTeacherId] = useState('');
  const [roomId, setRoomId] = useState('');
  useEffect(() => {
    if (classes.length && !classId) setClassId(classes[0].id);
  }, [classes, classId]);
  const periods = useApi<any[]>('/timetable/periods');
  const staff = useApi(view === 'teacher' || can('TIMETABLE_MANAGE') ? '/staff?pageSize=200&staffType=TEACHING' : null);
  const rooms = useApi<any[]>('/academic/rooms');
  const path =
    view === 'my'
      ? '/timetable/my'
      : view === 'class' && classId
        ? `/timetable/class/${classId}`
        : view === 'teacher' && teacherId
          ? `/timetable/teacher/${teacherId}`
          : view === 'room' && roomId
            ? `/timetable/room/${roomId}`
            : null;
  const { data: slots, loading, reload } = useApi(path, [path]);
  const conflicts = useApi(can('TIMETABLE_MANAGE') ? '/timetable/conflicts' : null);
  const { data: cls } = useApi(classId ? `/academic/classes/${classId}` : null, [classId]);
  const [modal, setModal] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({ classId: '', subjectId: '', teacherId: '', roomId: '' });
  const grid = useMemo(() => {
    const m: Record<string, any> = {};
    (slots ?? []).forEach((s: any) => (m[`${s.dayOfWeek}-${s.periodId}`] = s));
    return m;
  }, [slots]);
  const save = async () => {
    setBusy(true);
    try {
      await api.post('/timetable/slots', {
        classId: f.classId || classId,
        subjectId: f.subjectId,
        teacherId: f.teacherId || undefined,
        roomId: f.roomId || undefined,
        dayOfWeek: modal.day,
        periodId: modal.periodId,
      });
      toast.success('Lesson added');
      setModal(null);
      reload();
      conflicts.reload();
    } catch (e: any) {
      toast.error(e.code === 'TIMETABLE_CONFLICT' ? `Conflict: ${e.message}` : e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    if (!confirm('Remove this lesson?')) return;
    try {
      await api.delete(`/timetable/slots/${id}`);
      reload();
      conflicts.reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const editable = can('TIMETABLE_MANAGE') && view === 'class';
  const subjectOptions = (cls?.subjects ?? []).map((s: any) => ({ value: s.subjectId, label: s.subject.name }));
  return (
    <div>
      <PageHeader
        title="Timetable"
        subtitle="Teacher and room clashes are blocked automatically"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                openBlob(
                  `/documents/timetable/${view === 'teacher' ? 'teacher' : view === 'room' ? 'room' : 'class'}/${view === 'teacher' ? teacherId : view === 'room' ? roomId : view === 'my' ? me?.links?.staffId : classId}.pdf`,
                )
              }
            >
              PDF
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={16} /> Print
            </Button>
          </>
        }
      />
      <Tabs
        value={view}
        onChange={setView}
        tabs={[
          ...(me?.links?.staffId ? [{ id: 'my', label: 'My timetable' }] : []),
          { id: 'class', label: 'By class' },
          { id: 'teacher', label: 'By teacher' },
          { id: 'room', label: 'By room' },
        ]}
      />
      <div className="no-print mb-4 grid gap-3 sm:grid-cols-3">
        {view === 'class' && (
          <Field label="Class">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)} options={classOptions(classes)} />
          </Field>
        )}
        {view === 'teacher' && (
          <Field label="Teacher">
            <Select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              placeholder="Select teacher"
              options={(staff.data?.items ?? []).map((s: any) => ({
                value: s.id,
                label: `${s.firstName} ${s.lastName}`,
              }))}
            />
          </Field>
        )}
        {view === 'room' && (
          <Field label="Room">
            <Select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Select room"
              options={(rooms.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
            />
          </Field>
        )}
      </div>
      {conflicts.data?.length > 0 && (
        <Alert kind="warning" className="no-print mb-4">
          <AlertTriangle size={14} className="mr-1 inline" />
          {conflicts.data.length} existing clash(es):{' '}
          {conflicts.data
            .slice(0, 3)
            .map((c: any) => `${c.type.toLowerCase()} on ${DAYS[c.dayOfWeek]} ${c.period}`)
            .join('; ')}
        </Alert>
      )}
      {!periods.data ? (
        <Spinner />
      ) : !periods.data.length ? (
        <Alert kind="info">No periods defined yet. Add periods under Settings → Rules → Timetable periods.</Alert>
      ) : loading ? (
        <Spinner />
      ) : (
        <Card padded={false} className="overflow-x-auto">
          <table className="table min-w-[800px]">
            <thead>
              <tr>
                <th className="w-32">Period</th>
                {[1, 2, 3, 4, 5].map((d) => (
                  <th key={d}>{DAYS[d]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.data.map((p) => (
                <tr key={p.id} className={p.isBreak ? 'bg-slate-50' : ''}>
                  <td className="whitespace-nowrap">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.startTime}–{p.endTime}
                    </p>
                  </td>
                  {[1, 2, 3, 4, 5].map((d) => {
                    const s = grid[`${d}-${p.id}`];
                    return (
                      <td key={d} className="h-16 align-top">
                        {p.isBreak ? (
                          <span className="text-xs text-slate-400">Break</span>
                        ) : s ? (
                          <div className="group rounded-md bg-brand-soft p-1.5 text-xs">
                            <p className="font-semibold text-brand-dark">{s.subject.name}</p>
                            <p className="text-slate-600">
                              {view === 'class'
                                ? s.teacher
                                  ? `${s.teacher.firstName} ${s.teacher.lastName}`
                                  : ''
                                : s.class.name}
                              {s.room ? ` · ${s.room.name}` : ''}
                            </p>
                            {editable && (
                              <button
                                onClick={() => remove(s.id)}
                                className="mt-1 hidden text-red-600 group-hover:inline"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ) : editable ? (
                          <button
                            onClick={() => {
                              setF({ classId, subjectId: '', teacherId: '', roomId: '' });
                              setModal({ day: d, periodId: p.id });
                            }}
                            className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-slate-200 text-slate-300 hover:border-brand hover:text-brand"
                          >
                            <Plus size={14} />
                          </button>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal ? `Add lesson · ${DAYS[modal.day]}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy} disabled={!f.subjectId}>
              Add
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="Subject">
            <Select
              value={f.subjectId}
              onChange={(e) => {
                const cs = cls?.subjects.find((x: any) => x.subjectId === e.target.value);
                setF({ ...f, subjectId: e.target.value, teacherId: cs?.teacherId ?? '' });
              }}
              placeholder="Select subject"
              options={subjectOptions}
            />
          </Field>
          <Field label="Teacher" hint="Defaults to the subject teacher">
            <Select
              value={f.teacherId}
              onChange={(e) => setF({ ...f, teacherId: e.target.value })}
              placeholder="No teacher"
              options={(staff.data?.items ?? []).map((s: any) => ({
                value: s.id,
                label: `${s.firstName} ${s.lastName}`,
              }))}
            />
          </Field>
          <Field label="Room">
            <Select
              value={f.roomId}
              onChange={(e) => setF({ ...f, roomId: e.target.value })}
              placeholder="No room"
              options={(rooms.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
export default function TimetablePage() {
  return (
    <Suspense>
      <Timetable />
    </Suspense>
  );
}
