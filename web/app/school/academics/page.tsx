'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate, title } from '@/lib/format';
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
  const staff = useApi(
    tab === 'classes' || tab === 'responsibilities' ? '/staff?pageSize=200&staffType=TEACHING' : null,
    [tab],
  );
  const [modal, setModal] = useState<string | null>(null);
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const manage = can('ACADEMIC_MANAGE');
  const [preview, setPreview] = useState<any>(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [respectResults, setRespectResults] = useState(true);
  const [yearForm, setYearForm] = useState<any>({
    newYearName: '',
    startDate: '',
    endDate: '',
    terms: [
      { name: 'Term 1', startDate: '', endDate: '' },
      { name: 'Term 2', startDate: '', endDate: '' },
      { name: 'Term 3', startDate: '', endDate: '' },
    ],
  });
  const runPreview = async () => {
    setPreviewing(true);
    try {
      const p = await api.post('/academic/rollover/preview', { respectResults });
      setPreview(p);
      if (p.suggestedNextYear) setYearForm((f: any) => ({ ...f, newYearName: f.newYearName || p.suggestedNextYear }));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPreviewing(false);
    }
  };
  const commitRollover = async () => {
    if (!confirm('This starts a new academic year and moves every class up. This cannot be undone. Continue?'))
      return;
    setCommitting(true);
    try {
      await api.post('/academic/rollover', { ...yearForm, respectResults });
      toast.success('New academic year started');
      setPreview(null);
      years.reload();
      classes.reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCommitting(false);
    }
  };
  const responsibilities = useApi<any>(
    tab === 'responsibilities' ? '/academic/staff-responsibilities' : null,
    [tab],
  );
  const [newHouseName, setNewHouseName] = useState('');
  const [savingHouse, setSavingHouse] = useState(false);
  const assignFormMaster = async (classId: string, classTeacherId: string) => {
    try {
      await api.patch(`/academic/classes/${classId}`, { classTeacherId: classTeacherId || null });
      toast.success('Form master updated');
      responsibilities.reload();
      classes.reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const createHouse = async () => {
    if (!newHouseName.trim()) return toast.error('Give the house a name');
    setSavingHouse(true);
    try {
      await api.post('/academic/houses', { name: newHouseName.trim() });
      toast.success('House added');
      setNewHouseName('');
      responsibilities.reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingHouse(false);
    }
  };
  const assignHouseMaster = async (houseId: string, houseMasterId: string) => {
    try {
      await api.patch(`/academic/houses/${houseId}`, { houseMasterId: houseMasterId || null });
      toast.success('House master updated');
      responsibilities.reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const removeHouse = async (houseId: string) => {
    if (!confirm('Remove this house?')) return;
    try {
      await api.delete(`/academic/houses/${houseId}`);
      toast.success('House removed');
      responsibilities.reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
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
          { id: 'promotion', label: 'Year-end promotion' },
          { id: 'responsibilities', label: 'Staff responsibilities' },
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
      {tab === 'promotion' && (
        <div className="space-y-4">
          <Card title="Preview this year's promotion">
            <p className="mb-3 text-sm text-slate-500">
              Uses the last term's results against the promotion and probation averages set in Settings
              &gt; Rules engine. Nothing is written until you start the new year below.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Checkbox
                label="Base promotion on results (uncheck to promote everyone regardless of marks)"
                checked={respectResults}
                onChange={(e) => setRespectResults(e.target.checked)}
              />
              <Button onClick={runPreview} loading={previewing}>
                Preview
              </Button>
            </div>
          </Card>
          {preview && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Card title="Students" className="text-center">
                  <p className="text-2xl font-bold text-slate-800">{preview.totals.students}</p>
                </Card>
                <Card title="Promoted" className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{preview.totals.promote}</p>
                </Card>
                <Card title="On probation" className="text-center">
                  <p className="text-2xl font-bold text-amber-600">{preview.totals.probationByResults}</p>
                </Card>
                <Card title="Repeat" className="text-center">
                  <p className="text-2xl font-bold text-red-600">{preview.totals.repeatByResults}</p>
                </Card>
                <Card title="Graduating" className="text-center">
                  <p className="text-2xl font-bold text-brand">{preview.totals.graduate}</p>
                </Card>
              </div>
              <Card title="Per class" padded={false}>
                <DataTable
                  rows={preview.plan}
                  columns={[
                    { key: 'fromClass', header: 'Class' },
                    { key: 'students', header: 'Students', align: 'right' },
                    { key: 'action', header: 'Action', render: (p: any) => <Badge>{p.action}</Badge> },
                    { key: 'toClass', header: 'Moves to', render: (p: any) => p.toClass ?? '\u2014' },
                  ]}
                />
              </Card>
              <Card title="Start the new academic year">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="New year name" hint="e.g. 2027/2028">
                    <Input
                      value={yearForm.newYearName}
                      onChange={(e) => setYearForm({ ...yearForm, newYearName: e.target.value })}
                    />
                  </Field>
                  <Field label="Start date">
                    <Input
                      type="date"
                      value={yearForm.startDate}
                      onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })}
                    />
                  </Field>
                  <Field label="End date">
                    <Input
                      type="date"
                      value={yearForm.endDate}
                      onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })}
                    />
                  </Field>
                </div>
                <p className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Terms</p>
                <div className="space-y-2">
                  {yearForm.terms.map((t: any, i: number) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-3">
                      <Input
                        value={t.name}
                        placeholder="Term name"
                        onChange={(e) => {
                          const terms = [...yearForm.terms];
                          terms[i] = { ...terms[i], name: e.target.value };
                          setYearForm({ ...yearForm, terms });
                        }}
                      />
                      <Input
                        type="date"
                        value={t.startDate}
                        onChange={(e) => {
                          const terms = [...yearForm.terms];
                          terms[i] = { ...terms[i], startDate: e.target.value };
                          setYearForm({ ...yearForm, terms });
                        }}
                      />
                      <Input
                        type="date"
                        value={t.endDate}
                        onChange={(e) => {
                          const terms = [...yearForm.terms];
                          terms[i] = { ...terms[i], endDate: e.target.value };
                          setYearForm({ ...yearForm, terms });
                        }}
                      />
                    </div>
                  ))}
                </div>
                {can('SCHOOL_MANAGE') ? (
                  <Button className="mt-4" onClick={commitRollover} loading={committing}>
                    Start new year &amp; promote students
                  </Button>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    Starting the new year needs the School Admin's sign-off.
                  </p>
                )}
              </Card>
            </>
          )}
        </div>
      )}
      {tab === 'responsibilities' && (
        <div className="space-y-4">
          <Card title="Form masters" padded={false}>
            <p className="border-b border-slate-100 px-4 py-3 text-sm text-slate-500">
              The form master for a class also gets attendance-marking rights for that class
              automatically.
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Form master</th>
                </tr>
              </thead>
              <tbody>
                {(responsibilities.data?.classes ?? []).map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      {c.name} <span className="text-slate-400">({title(c.level)})</span>
                    </td>
                    <td>
                      <Select
                        value={c.classTeacherId ?? ''}
                        onChange={(e) => assignFormMaster(c.id, e.target.value)}
                        placeholder="Unassigned"
                        options={(staff.data?.items ?? []).map((s: any) => ({
                          value: s.id,
                          label: `${s.firstName} ${s.lastName}`,
                        }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Houses & house masters" padded={false}>
            <div className="flex items-center gap-2 border-b border-slate-100 p-3">
              <Input
                value={newHouseName}
                onChange={(e) => setNewHouseName(e.target.value)}
                placeholder="New house name, e.g. Red House"
                className="max-w-xs"
              />
              <Button variant="secondary" onClick={createHouse} loading={savingHouse}>
                <Plus size={14} /> Add house
              </Button>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>House</th>
                  <th>House master</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(responsibilities.data?.houses ?? []).map((h: any) => (
                  <tr key={h.id}>
                    <td>{h.name}</td>
                    <td>
                      <Select
                        value={h.houseMasterId ?? ''}
                        onChange={(e) => assignHouseMaster(h.id, e.target.value)}
                        placeholder="Unassigned"
                        options={(staff.data?.items ?? []).map((s: any) => ({
                          value: s.id,
                          label: `${s.firstName} ${s.lastName}`,
                        }))}
                      />
                    </td>
                    <td className="text-right">
                      <button className="text-xs text-red-600 hover:underline" onClick={() => removeHouse(h.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {!responsibilities.data?.houses?.length && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-sm text-slate-500">
                      No houses yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
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
