'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCheck, CloudDownload, Download, WifiOff } from 'lucide-react';
import clsx from 'clsx';
import { api, downloadBlob, qs } from '@/lib/api';
import { useAcademic, classOptions } from '@/lib/academic';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { cacheGet, pullSnapshot, queueOp, useOffline } from '@/lib/offline';
import { ago, fmtDate, todayIso } from '@/lib/format';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Tabs,
  useToast,
} from '@/components/ui';

const STATUSES = [
  ['PRESENT', 'P', 'bg-emerald-600'],
  ['ABSENT', 'A', 'bg-red-600'],
  ['LATE', 'L', 'bg-amber-500'],
  ['EXCUSED', 'E', 'bg-sky-600'],
  ['SICK', 'S', 'bg-violet-600'],
] as const;

function MarkTab({ classes }: { classes: any[] }) {
  const params = useSearchParams();
  const toast = useToast();
  const offline = useOffline();
  const [classId, setClassId] = useState(params.get('classId') ?? '');
  const [date, setDate] = useState(todayIso());
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, { status: string; note?: string }>>({});
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'online' | 'cache' | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastPull, setLastPull] = useState<string | null>(
    typeof localStorage === 'undefined' ? null : localStorage.getItem('schoolos.lastPull'),
  );
  useEffect(() => {
    if (!classId && classes.length) setClassId(classes[0].id);
  }, [classes, classId]);

  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const r = await api.get(`/attendance/register${qs({ classId, date })}`);
      setStudents(r.students);
      setSource('online');
      const m: any = {};
      r.students.forEach((s: any) => {
        if (s.attendance) m[s.id] = { status: s.attendance.status, note: s.attendance.note ?? undefined };
      });
      setMarks(m);
    } catch {
      const snap = await cacheGet('snapshot');
      if (!snap) {
        toast.error('Offline and no snapshot on this device. Download the class list while online first.');
        setStudents([]);
        setSource(null);
      } else {
        setStudents(
          snap.students.filter((s: any) => s.classId === classId).map((s: any) => ({ ...s, attendance: null })),
        );
        setSource('cache');
        const m: any = {};
        snap.attendance
          .filter((a: any) => a.classId === classId && String(a.date).slice(0, 10) === date)
          .forEach((a: any) => {
            m[a.studentId] = { status: a.status, note: a.note ?? undefined };
          });
        setMarks(m);
      }
    } finally {
      setLoading(false);
    }
  }, [classId, date, toast]);
  useEffect(() => {
    load();
  }, [load]);

  const setStatus = (id: string, status: string) => setMarks({ ...marks, [id]: { ...marks[id], status } });
  const allPresent = () => {
    const m: any = {};
    students.forEach((s) => (m[s.id] = { status: 'PRESENT' }));
    setMarks(m);
  };
  const counts = useMemo(
    () => Object.values(marks).reduce((a: any, m) => ({ ...a, [m.status]: (a[m.status] ?? 0) + 1 }), {}),
    [marks],
  );
  const save = async () => {
    const records = students
      .filter((s) => marks[s.id])
      .map((s) => ({ studentId: s.id, status: marks[s.id].status, note: marks[s.id].note || undefined }));
    if (!records.length) return toast.error('Mark at least one student');
    setSaving(true);
    const cls = classes.find((c) => c.id === classId)?.name ?? 'class';
    try {
      if (!navigator.onLine) throw Object.assign(new Error('offline'), { code: 'NETWORK' });
      const r = await api.post('/attendance/mark', { classId, date, records });
      toast.success(`Saved: ${r.applied} marked${r.invalid.length ? `, ${r.invalid.length} invalid` : ''}`);
      pullSnapshot()
        .then(() => setLastPull(localStorage.getItem('schoolos.lastPull')))
        .catch(() => undefined);
    } catch (e: any) {
      if (e.code === 'NETWORK' || e.status === 0) {
        await queueOp('attendance', 'mark', { classId, date, records }, `${cls} · ${date}`);
        toast.info(`Saved offline for ${cls}. It will sync automatically when you're back online.`);
      } else toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  const download = async () => {
    try {
      const s = await pullSnapshot();
      setLastPull(s.serverTime);
      toast.success(`Downloaded ${s.students.length} students in ${s.classes.length} classes for offline use`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Field label="Class">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)} options={classOptions(classes)} />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="flex items-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={allPresent} disabled={!students.length}>
            <CheckCheck size={16} /> All present
          </Button>
          <Button
            variant="secondary"
            onClick={download}
            disabled={!offline.online}
            title={lastPull ? `Last downloaded ${ago(lastPull)}` : ''}
          >
            <CloudDownload size={16} /> Download for offline
          </Button>
        </div>
      </div>
      {!offline.online && (
        <Alert kind="warning" className="mb-4">
          <WifiOff size={14} className="mr-1 inline" /> You are offline
          {source === 'cache' ? ' — showing the downloaded class list' : ''}. Marks are saved on this device and synced
          later.
        </Alert>
      )}
      {offline.pending > 0 && (
        <Alert kind="info" className="mb-4">
          {offline.pending} attendance record(s) waiting to sync.{' '}
          <button className="font-semibold underline" onClick={() => offline.sync()}>
            Sync now
          </button>
        </Alert>
      )}
      {loading ? (
        <Spinner />
      ) : (
        <Card padded={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2 text-xs text-slate-600">
            {STATUSES.map(([s, k]) => (
              <span key={s}>
                <b>{counts[s] ?? 0}</b> {s.toLowerCase()}
              </span>
            ))}
            <span className="ml-auto">
              {Object.keys(marks).length} / {students.length} marked{source === 'cache' && ' · offline copy'}
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {students.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2">
                <Avatar name={`${s.firstName} ${s.lastName}`} src={s.photoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {s.firstName} {s.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{s.studentId}</p>
                </div>
                <div className="flex gap-1">
                  {STATUSES.map(([st, k, color]) => (
                    <button
                      key={st}
                      onClick={() => setStatus(s.id, st)}
                      title={st}
                      className={clsx(
                        'h-8 w-8 rounded-md text-xs font-bold transition',
                        marks[s.id]?.status === st
                          ? `${color} text-white`
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                      )}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <input
                  className="input hidden w-40 sm:block"
                  placeholder="Note"
                  value={marks[s.id]?.note ?? ''}
                  onChange={(e) =>
                    setMarks({ ...marks, [s.id]: { status: marks[s.id]?.status ?? 'PRESENT', note: e.target.value } })
                  }
                />
              </li>
            ))}
            {!students.length && (
              <li className="py-8 text-center text-sm text-slate-500">No students in this class.</li>
            )}
          </ul>
          <div className="flex justify-end border-t border-slate-100 p-3">
            <Button onClick={save} loading={saving} disabled={!students.length}>
              Save attendance
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function ReportsTab({ classes }: { classes: any[] }) {
  const { can } = useAuth();
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(todayIso());
  useEffect(() => {
    if (!classId && classes.length) setClassId(classes[0].id);
  }, [classes, classId]);
  const { data, loading } = useApi(classId ? `/attendance/summary${qs({ classId, from, to })}` : null, [
    classId,
    from,
    to,
  ]);
  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Field label="Class">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)} options={classOptions(classes)} />
        </Field>
        <Field label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="flex items-end">
          {can('EXPORT_DATA') && (
            <Button
              variant="secondary"
              onClick={() => downloadBlob(`/exports/attendance.csv${qs({ classId, from, to })}`, 'attendance.csv')}
            >
              <Download size={16} /> Export CSV
            </Button>
          )}
        </div>
      </div>
      {data && (
        <p className="mb-3 text-sm text-slate-600">
          {data.schoolDays} school day(s) recorded · minimum attendance {data.minimumAttendancePercent}%
        </p>
      )}
      <DataTable
        rows={data?.students}
        loading={loading}
        columns={[
          {
            key: 'name',
            header: 'Student',
            render: (s: any) => (
              <Link href={`/school/students/${s.id}`} className="hover:underline">
                {s.firstName} {s.lastName}
              </Link>
            ),
          },
          { key: 'PRESENT', header: 'Present', align: 'right' },
          { key: 'LATE', header: 'Late', align: 'right' },
          { key: 'ABSENT', header: 'Absent', align: 'right' },
          { key: 'EXCUSED', header: 'Excused', align: 'right' },
          { key: 'SICK', header: 'Sick', align: 'right' },
          {
            key: 'rate',
            header: 'Rate',
            align: 'right',
            render: (s: any) => (
              <span className={s.belowMinimum ? 'font-semibold text-red-700' : ''}>
                {s.rate}%{s.belowMinimum && ' ⚠'}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}

function DailyTab() {
  const [date, setDate] = useState(todayIso());
  const { data, loading } = useApi(`/attendance/daily${qs({ date })}`, [date]);
  return (
    <div>
      <div className="mb-4 max-w-xs">
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      {data && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <Badge tone="emerald">{`Present ${data.PRESENT + data.LATE}`}</Badge>
          <Badge tone="red">{`Absent ${data.ABSENT}`}</Badge>
          <Badge tone="sky">{`Excused ${data.EXCUSED}`}</Badge>
          <Badge tone="violet">{`Sick ${data.SICK}`}</Badge>
          <Badge tone="slate">{`Unmarked ${data.unmarked}`}</Badge>
          <span className="ml-auto font-medium">Rate {data.rate}%</span>
        </div>
      )}
      <DataTable
        rows={data?.classes}
        loading={loading}
        keyField="classId"
        columns={[
          {
            key: 'name',
            header: 'Class',
            render: (c: any) => (
              <Link href={`/school/attendance?classId=${c.classId}`} className="hover:underline">
                {c.name}
              </Link>
            ),
          },
          { key: 'enrolled', header: 'Enrolled', align: 'right' },
          {
            key: 'marked',
            header: 'Marked',
            align: 'right',
            render: (c: any) =>
              c.marked === c.enrolled ? (
                <span className="text-emerald-700">{c.marked}</span>
              ) : (
                <span className="text-amber-700">{c.marked}</span>
              ),
          },
          { key: 'PRESENT', header: 'Present', align: 'right' },
          { key: 'ABSENT', header: 'Absent', align: 'right' },
          { key: 'LATE', header: 'Late', align: 'right' },
        ]}
      />
    </div>
  );
}

function Attendance() {
  const { role, can } = useAuth();
  const { classes: all } = useAcademic();
  const { data: mine } = useApi(role === 'teacher' ? '/staff/my-classes' : null);
  const classes = useMemo(() => {
    if (role !== 'teacher' || can('ACADEMIC_MANAGE')) return all;
    if (!mine) return [];
    const ids = new Set<string>([
      ...mine.classTeacherOf.map((c: any) => c.id),
      ...mine.teaching.map((t: any) => t.classId),
    ]);
    return all.filter((c) => ids.has(c.id));
  }, [all, mine, role, can]);
  const [tab, setTab] = useState('mark');
  return (
    <div>
      <PageHeader title="Attendance" subtitle="Works offline — marks sync automatically when you reconnect" />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'mark', label: 'Mark register' },
          { id: 'reports', label: 'Reports' },
          ...(can('ATTENDANCE_VIEW') && role !== 'teacher' ? [{ id: 'daily', label: 'Daily overview' }] : []),
        ]}
      />
      {tab === 'mark' && <MarkTab classes={classes} />}
      {tab === 'reports' && <ReportsTab classes={classes} />}
      {tab === 'daily' && <DailyTab />}
    </div>
  );
}
export default function AttendancePage() {
  return (
    <Suspense>
      <Attendance />
    </Suspense>
  );
}
