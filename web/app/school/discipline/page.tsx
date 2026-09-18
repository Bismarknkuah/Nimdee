'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useAcademic, classOptions } from '@/lib/academic';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime, title, todayIso } from '@/lib/format';
import { BarSeries } from '@/components/charts';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  Field,
  Input,
  KeyStat,
  Modal,
  PageHeader,
  SearchBox,
  Select,
  Tabs,
  Textarea,
  useToast,
} from '@/components/ui';

/** Discipline & behaviour: log incidents, resolve them, track demerit points and trends. */
export default function DisciplinePage() {
  const toast = useToast();
  const { can } = useAuth();
  const { classes } = useAcademic();
  const [tab, setTab] = useState('incidents');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [classId, setClassId] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounce(search);
  const { data, loading, reload } = useApi(
    `/discipline/incidents${qs({ search: q, status, classId, page, pageSize: 25 })}`,
    [q, status, classId, page],
  );
  const overview = useApi(tab === 'overview' ? '/discipline/overview' : null, [tab]);
  const { data: categories } = useApi<string[]>('/discipline/categories');
  const [modal, setModal] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({});
  const [studentSearch, setStudentSearch] = useState('');
  const sq = useDebounce(studentSearch);
  const { data: studentResults } = useApi(sq.length >= 2 ? `/students${qs({ search: sq, pageSize: 6 })}` : null, [sq]);

  const openNew = () => {
    setF({
      studentId: '',
      studentName: '',
      date: todayIso(),
      category: 'LATENESS',
      severity: 'MINOR',
      description: '',
      actionTaken: '',
      points: 0,
      notifyParent: false,
    });
    setModal({});
  };
  const openEdit = (inc: any) => {
    setF({
      status: inc.status,
      actionTaken: inc.actionTaken ?? '',
      severity: inc.severity,
      points: inc.points,
      notifyParent: inc.parentNotified,
    });
    setModal(inc);
  };
  const save = async () => {
    setBusy(true);
    try {
      if (modal.id)
        await api.patch(`/discipline/incidents/${modal.id}`, {
          status: f.status,
          actionTaken: f.actionTaken || undefined,
          severity: f.severity,
          points: Number(f.points),
          notifyParent: f.notifyParent,
        });
      else
        await api.post('/discipline/incidents', {
          studentId: f.studentId,
          date: f.date,
          category: f.category,
          severity: f.severity,
          description: f.description,
          actionTaken: f.actionTaken || undefined,
          points: Number(f.points),
          notifyParent: f.notifyParent,
        });
      toast.success('Saved');
      setModal(null);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const bs = data?.byStatus ?? {};
  return (
    <div>
      <PageHeader
        title="Discipline & behaviour"
        subtitle="Incidents, sanctions and demerit points. Every record is audited"
        actions={
          can('DISCIPLINE_MANAGE') && (
            <Button onClick={openNew}>
              <Plus size={16} /> Log incident
            </Button>
          )
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <KeyStat label="Open" value={bs.OPEN ?? 0} tone="red" />
        <KeyStat label="Resolved" value={bs.RESOLVED ?? 0} tone="emerald" />
        <KeyStat label="Escalated" value={bs.ESCALATED ?? 0} tone="amber" />
        <KeyStat label="Total recorded" value={data?.total ?? 0} />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'incidents', label: 'Incidents' },
          { id: 'overview', label: 'Trends & overview' },
        ]}
      />
      {tab === 'incidents' && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <SearchBox
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder="Search description, category or student"
              />
            </div>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              placeholder="All statuses"
              options={['OPEN', 'RESOLVED', 'ESCALATED'].map((s) => ({ value: s, label: title(s) }))}
            />
            <Select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setPage(1);
              }}
              placeholder="All classes"
              options={classOptions(classes)}
            />
          </div>
          <DataTable
            rows={data?.items}
            loading={loading}
            page={page}
            pageSize={25}
            total={data?.total}
            onPage={setPage}
            onRowClick={can('DISCIPLINE_MANAGE') ? openEdit : undefined}
            emptyTitle="No incidents recorded"
            columns={[
              { key: 'date', header: 'Date', render: (i: any) => fmtDate(i.date) },
              {
                key: 'student',
                header: 'Student',
                render: (i: any) => (
                  <div>
                    <Link
                      href={`/school/students/${i.student.id}`}
                      className="font-medium hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {i.student.firstName} {i.student.lastName}
                    </Link>
                    <p className="text-xs text-slate-500">{i.student.class?.name}</p>
                  </div>
                ),
              },
              { key: 'category', header: 'Category', render: (i: any) => title(i.category) },
              {
                key: 'severity',
                header: 'Severity',
                render: (i: any) => (
                  <Badge tone={i.severity === 'SERIOUS' ? 'red' : i.severity === 'MODERATE' ? 'amber' : 'slate'}>
                    {i.severity}
                  </Badge>
                ),
              },
              {
                key: 'description',
                header: 'Description',
                render: (i: any) => <span className="line-clamp-2 text-slate-600">{i.description}</span>,
              },
              { key: 'points', header: 'Points', align: 'right' },
              { key: 'reportedByName', header: 'Reported by', render: (i: any) => i.reportedByName ?? '—' },
              { key: 'status', header: 'Status', render: (i: any) => <Badge>{i.status}</Badge> },
            ]}
          />
        </>
      )}
      {tab === 'overview' &&
        (overview.data ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Incidents per week (last 12 weeks)">
              <BarSeries
                data={overview.data.weekly}
                x="week"
                bars={[
                  { key: 'MINOR', color: '#94a3b8' },
                  { key: 'MODERATE', color: '#f59e0b' },
                  { key: 'SERIOUS', color: '#ef4444' },
                ]}
                stacked
              />
            </Card>
            <Card title="By category">
              <BarSeries
                data={overview.data.byCategory.map((c: any) => ({ category: title(c.category), count: c.count }))}
                x="category"
                bars={[{ key: 'count', name: 'Incidents' }]}
              />
            </Card>
            <Card title="By class" padded={false}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th className="text-right">Incidents (12 wks)</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.data.byClass.map((c: any) => (
                    <tr key={c.classId}>
                      <td>{c.name}</td>
                      <td className="text-right">{c.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card title="Students with most demerit points" padded={false}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th className="text-right">Incidents</th>
                    <th className="text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.data.topStudents.map((s: any) => (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/school/students/${s.id}`} className="hover:underline">
                          {s.firstName} {s.lastName}
                        </Link>
                      </td>
                      <td>{s.class?.name}</td>
                      <td className="text-right">{s.incidents}</td>
                      <td className="text-right font-semibold text-red-700">{s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Loading…</p>
        ))}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? `Incident · ${modal.student.firstName} ${modal.student.lastName}` : 'Log an incident'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy} disabled={!modal?.id && (!f.studentId || !f.description)}>
              Save
            </Button>
          </>
        }
      >
        {modal && !modal.id && (
          <div className="space-y-3">
            <Field label="Student">
              {f.studentId ? (
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span>{f.studentName}</span>
                  <button className="text-xs text-brand" onClick={() => setF({ ...f, studentId: '', studentName: '' })}>
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <SearchBox value={studentSearch} onChange={setStudentSearch} placeholder="Type a name or ID…" />
                  {studentResults?.items?.length > 0 && (
                    <ul className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {studentResults.items.map((s: any) => (
                        <li key={s.id}>
                          <button
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() => {
                              setF({
                                ...f,
                                studentId: s.id,
                                studentName: `${s.firstName} ${s.lastName} (${s.class?.name ?? '—'})`,
                              });
                              setStudentSearch('');
                            }}
                          >
                            {s.firstName} {s.lastName} <span className="text-slate-500">· {s.class?.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Date">
                <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
              </Field>
              <Field label="Category">
                <Select
                  value={f.category}
                  onChange={(e) => setF({ ...f, category: e.target.value })}
                  options={(categories ?? []).map((c) => ({ value: c, label: title(c) }))}
                />
              </Field>
              <Field label="Severity">
                <Select
                  value={f.severity}
                  onChange={(e) => setF({ ...f, severity: e.target.value })}
                  options={['MINOR', 'MODERATE', 'SERIOUS'].map((s) => ({ value: s, label: title(s) }))}
                />
              </Field>
            </div>
            <Field label="What happened">
              <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </Field>
          </div>
        )}
        {modal && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {modal.id && (
              <>
                <Field label="Status">
                  <Select
                    value={f.status}
                    onChange={(e) => setF({ ...f, status: e.target.value })}
                    options={['OPEN', 'RESOLVED', 'ESCALATED'].map((s) => ({ value: s, label: title(s) }))}
                  />
                </Field>
                <Field label="Severity">
                  <Select
                    value={f.severity}
                    onChange={(e) => setF({ ...f, severity: e.target.value })}
                    options={['MINOR', 'MODERATE', 'SERIOUS'].map((s) => ({ value: s, label: title(s) }))}
                  />
                </Field>
              </>
            )}
            <Field label="Action taken / sanction" className="sm:col-span-2">
              <Textarea value={f.actionTaken} onChange={(e) => setF({ ...f, actionTaken: e.target.value })} />
            </Field>
            <Field label="Demerit points">
              <Input type="number" min={0} value={f.points} onChange={(e) => setF({ ...f, points: e.target.value })} />
            </Field>
            <div className="flex items-end pb-2">
              <Checkbox
                label="Notify parent (in-app)"
                checked={!!f.notifyParent}
                onChange={(e) => setF({ ...f, notifyParent: e.target.checked })}
              />
            </div>
            {modal.id && (
              <p className="text-xs text-slate-500 sm:col-span-2">
                Recorded {fmtDateTime(modal.createdAt)}
                {modal.resolvedAt ? ` · resolved ${fmtDateTime(modal.resolvedAt)}` : ''}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
