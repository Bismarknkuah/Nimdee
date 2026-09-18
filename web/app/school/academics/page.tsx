'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
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
  Tabs,
  useToast,
} from '@/components/ui';

/** Academic structure: years & terms, classes, subjects, rooms. */
export default function AcademicsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('classes');
  const years = useApi<any[]>('/academic/years');
  const classes = useApi<any[]>('/academic/classes');
  const subjects = useApi<any[]>('/academic/subjects');
  const rooms = useApi<any[]>('/academic/rooms');
  const ghana = useApi<any>('/academic/ghana-basic');
  const [settingUp, setSettingUp] = useState(false);
  const staff = useApi(tab === 'classes' ? '/staff?pageSize=200&staffType=TEACHING' : null, [tab]);
  const [modal, setModal] = useState<string | null>(null);
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const manage = can('ACADEMIC_MANAGE');
  const set = (k: string) => (e: any) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async () => {
    setBusy(true);
    try {
      const body = { ...f };
      Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
      if (modal === 'year') {
        await api.post('/academic/years', body);
        years.reload();
      }
      if (modal === 'term') {
        await api.post('/academic/terms', body);
        years.reload();
      }
      if (modal === 'class') {
        await api.post('/academic/classes', { ...body, capacity: body.capacity ? Number(body.capacity) : undefined });
        classes.reload();
      }
      if (modal === 'subject') {
        await api.post('/academic/subjects', body);
        subjects.reload();
      }
      if (modal === 'room') {
        await api.post('/academic/rooms', { ...body, capacity: body.capacity ? Number(body.capacity) : undefined });
        rooms.reload();
      }
      toast.success('Saved');
      setModal(null);
      setF({});
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const setCurrentTerm = async (id: string) => {
    try {
      await api.patch(`/academic/terms/${id}`, { isCurrent: true });
      toast.success('Current term updated');
      years.reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const open = (kind: string, initial: any = {}) => {
    setF(initial);
    setModal(kind);
  };
  return (
    <div>
      <PageHeader title="Academics" subtitle="Academic years, terms, classes, subjects and rooms" />
      {manage && ghana.data && ghana.data.classes.some((c: any) => c.inScope && !c.exists) && (
        <Card title="Set up standard KG / Primary / JHS classes" className="mb-4">
          <p className="mb-3 text-sm text-slate-600">
            Create the standard classes and GES standards-based subjects for the levels this school runs. Existing
            classes and subjects are left untouched; this only adds what&apos;s missing.
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {ghana.data.classes
              .filter((c: any) => c.inScope)
              .map((c: any) => (
                <Badge key={c.name} tone={c.exists ? 'emerald' : 'slate'}>
                  {c.name}
                  {c.exists ? ' ✓' : ''}
                </Badge>
              ))}
          </div>
          <Button
            loading={settingUp}
            onClick={async () => {
              setSettingUp(true);
              try {
                const r = await api.post('/academic/ghana-basic/setup', {});
                toast.success(`Created ${r.classesCreated} class(es) and ${r.subjectsCreated} subject(s)`);
                classes.reload();
                subjects.reload();
                ghana.reload();
              } catch (e: any) {
                toast.error(e.message);
              } finally {
                setSettingUp(false);
              }
            }}
          >
            Set up standard classes & subjects
          </Button>
        </Card>
      )}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'classes', label: 'Classes', count: classes.data?.length },
          { id: 'subjects', label: 'Subjects', count: subjects.data?.length },
          { id: 'years', label: 'Years & terms' },
          { id: 'rooms', label: 'Rooms', count: rooms.data?.length },
        ]}
      />
      {tab === 'classes' && (
        <>
          {manage && (
            <div className="mb-3 flex justify-end">
              <Button onClick={() => open('class', { level: 'PRIMARY' })}>
                <Plus size={16} /> New class
              </Button>
            </div>
          )}
          <DataTable
            rows={classes.data}
            loading={classes.loading}
            columns={[
              {
                key: 'name',
                header: 'Class',
                render: (c: any) => (
                  <Link href={`/school/classes/${c.id}`} className="font-medium text-brand hover:underline">
                    {c.name}
                  </Link>
                ),
              },
              { key: 'level', header: 'Level' },
              {
                key: 'teacher',
                header: 'Class teacher',
                render: (c: any) =>
                  c.classTeacher ? (
                    `${c.classTeacher.firstName} ${c.classTeacher.lastName}`
                  ) : (
                    <span className="text-slate-400">Unassigned</span>
                  ),
              },
              {
                key: 'studentCount',
                header: 'Students',
                align: 'right',
                render: (c: any) => `${c.studentCount}${c.capacity ? ` / ${c.capacity}` : ''}`,
              },
              { key: 'subjectCount', header: 'Subjects', align: 'right' },
            ]}
          />
        </>
      )}
      {tab === 'subjects' && (
        <>
          {manage && (
            <div className="mb-3 flex justify-end">
              <Button onClick={() => open('subject', { isCore: true })}>
                <Plus size={16} /> New subject
              </Button>
            </div>
          )}
          <DataTable
            rows={subjects.data}
            loading={subjects.loading}
            columns={[
              { key: 'name', header: 'Subject' },
              { key: 'code', header: 'Code' },
              {
                key: 'isCore',
                header: 'Type',
                render: (s: any) => <Badge tone={s.isCore ? 'brand' : 'slate'}>{s.isCore ? 'Core' : 'Elective'}</Badge>,
              },
              { key: 'classes', header: 'Classes', align: 'right', render: (s: any) => s._count?.classes ?? 0 },
              {
                key: 'x',
                header: '',
                render: (s: any) =>
                  manage && (
                    <button
                      className="text-xs text-red-600 hover:underline"
                      onClick={async () => {
                        if (!confirm(`Delete ${s.name}?`)) return;
                        try {
                          await api.delete(`/academic/subjects/${s.id}`);
                          subjects.reload();
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                    >
                      Delete
                    </button>
                  ),
              },
            ]}
          />
        </>
      )}
      {tab === 'years' && (
        <div className="space-y-4">
          {manage && (
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => open('term', { academicYearId: years.data?.find((y) => y.isCurrent)?.id ?? '' })}
              >
                Add term
              </Button>
              <Button onClick={() => open('year', {})}>
                <Plus size={16} /> New academic year
              </Button>
            </div>
          )}
          {(years.data ?? []).map((y) => (
            <Card
              key={y.id}
              title={
                <span>
                  {y.name} {y.isCurrent && <Badge tone="brand">Current</Badge>}
                </span>
              }
              actions={
                <span className="text-xs text-slate-500">
                  {fmtDate(y.startDate)} – {fmtDate(y.endDate)}
                </span>
              }
              padded={false}
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>Term</th>
                    <th>Dates</th>
                    <th>Exams</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {y.terms.map((t: any) => (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td>
                        {fmtDate(t.startDate)} – {fmtDate(t.endDate)}
                      </td>
                      <td>{t.examStart ? `${fmtDate(t.examStart)} – ${fmtDate(t.examEnd)}` : '—'}</td>
                      <td>{t.isCurrent && <Badge tone="brand">Current</Badge>}</td>
                      <td className="text-right">
                        {manage && !t.isCurrent && (
                          <button className="text-xs text-brand hover:underline" onClick={() => setCurrentTerm(t.id)}>
                            Make current
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      )}
      {tab === 'rooms' && (
        <>
          {manage && (
            <div className="mb-3 flex justify-end">
              <Button onClick={() => open('room', {})}>
                <Plus size={16} /> New room
              </Button>
            </div>
          )}
          <DataTable
            rows={rooms.data}
            loading={rooms.loading}
            columns={[
              { key: 'name', header: 'Room' },
              { key: 'capacity', header: 'Capacity', align: 'right', render: (r: any) => r.capacity ?? '—' },
              {
                key: 'x',
                header: '',
                render: (r: any) =>
                  manage && (
                    <button
                      className="text-xs text-red-600 hover:underline"
                      onClick={async () => {
                        if (!confirm(`Delete ${r.name}?`)) return;
                        try {
                          await api.delete(`/academic/rooms/${r.id}`);
                          rooms.reload();
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                    >
                      Delete
                    </button>
                  ),
              },
            ]}
          />
        </>
      )}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={
          { year: 'New academic year', term: 'Add term', class: 'New class', subject: 'New subject', room: 'New room' }[
            modal ?? 'class'
          ]
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={busy}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {modal === 'year' && (
            <>
              <Field label="Name" className="sm:col-span-2">
                <Input value={f.name ?? ''} onChange={set('name')} placeholder="2026/2027" />
              </Field>
              <Field label="Start">
                <Input type="date" value={f.startDate ?? ''} onChange={set('startDate')} />
              </Field>
              <Field label="End">
                <Input type="date" value={f.endDate ?? ''} onChange={set('endDate')} />
              </Field>
              <div className="sm:col-span-2">
                <Checkbox label="Make this the current year" checked={!!f.isCurrent} onChange={set('isCurrent')} />
              </div>
            </>
          )}
          {modal === 'term' && (
            <>
              <Field label="Academic year" className="sm:col-span-2">
                <Select
                  value={f.academicYearId ?? ''}
                  onChange={set('academicYearId')}
                  placeholder="Select"
                  options={(years.data ?? []).map((y) => ({ value: y.id, label: y.name }))}
                />
              </Field>
              <Field label="Name">
                <Input value={f.name ?? ''} onChange={set('name')} placeholder="Term 1" />
              </Field>
              <Field label="Sequence">
                <Input type="number" value={f.sequence ?? ''} onChange={set('sequence')} />
              </Field>
              <Field label="Start">
                <Input type="date" value={f.startDate ?? ''} onChange={set('startDate')} />
              </Field>
              <Field label="End">
                <Input type="date" value={f.endDate ?? ''} onChange={set('endDate')} />
              </Field>
              <Field label="Exams start">
                <Input type="date" value={f.examStart ?? ''} onChange={set('examStart')} />
              </Field>
              <Field label="Exams end">
                <Input type="date" value={f.examEnd ?? ''} onChange={set('examEnd')} />
              </Field>
              <div className="sm:col-span-2">
                <Checkbox label="Make this the current term" checked={!!f.isCurrent} onChange={set('isCurrent')} />
              </div>
            </>
          )}
          {modal === 'class' && (
            <>
              <Field label="Class name">
                <Input value={f.name ?? ''} onChange={set('name')} placeholder="Basic 4" />
              </Field>
              <Field label="Level" hint="Used to match fee structures and grading">
                <Select
                  value={f.level ?? 'PRIMARY'}
                  onChange={set('level')}
                  options={[
                    { value: 'KG', label: 'Kindergarten' },
                    { value: 'PRIMARY', label: 'Primary (Basic 1–6)' },
                    { value: 'JHS', label: 'JHS (Basic 7–9)' },
                  ]}
                />
              </Field>
              <Field label="Stream">
                <Input value={f.stream ?? ''} onChange={set('stream')} placeholder="A" />
              </Field>
              <Field label="Capacity">
                <Input type="number" value={f.capacity ?? ''} onChange={set('capacity')} />
              </Field>
              <Field label="Class teacher" className="sm:col-span-2">
                <Select
                  value={f.classTeacherId ?? ''}
                  onChange={set('classTeacherId')}
                  placeholder="Unassigned"
                  options={(staff.data?.items ?? []).map((s: any) => ({
                    value: s.id,
                    label: `${s.firstName} ${s.lastName}`,
                  }))}
                />
              </Field>
            </>
          )}
          {modal === 'subject' && (
            <>
              <Field label="Subject name">
                <Input value={f.name ?? ''} onChange={set('name')} />
              </Field>
              <Field label="Code">
                <Input value={f.code ?? ''} onChange={set('code')} placeholder="MATH" />
              </Field>
              <div className="sm:col-span-2">
                <Checkbox label="Core subject" checked={!!f.isCore} onChange={set('isCore')} />
              </div>
            </>
          )}
          {modal === 'room' && (
            <>
              <Field label="Room name">
                <Input value={f.name ?? ''} onChange={set('name')} />
              </Field>
              <Field label="Capacity">
                <Input type="number" value={f.capacity ?? ''} onChange={set('capacity')} />
              </Field>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
