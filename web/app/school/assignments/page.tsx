'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useAcademic, classOptions } from '@/lib/academic';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import {
  Badge,
  Button,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';

/** Homework & assignments: teachers publish work per class/subject and track completion. */
export default function AssignmentsPage() {
  const toast = useToast();
  const { can, role } = useAuth();
  const { classes: all } = useAcademic();
  const { data: mine } = useApi(role === 'teacher' ? '/staff/my-classes' : null);
  const classes = useMemo(() => {
    if (role !== 'teacher' || can('ACADEMIC_MANAGE') || !mine) return all;
    const ids = new Set<string>([
      ...mine.classTeacherOf.map((c: any) => c.id),
      ...mine.teaching.map((t: any) => t.classId),
    ]);
    return all.filter((c) => ids.has(c.id));
  }, [all, mine, role, can]);
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('');
  const { data, loading, reload } = useApi<any[]>(`/assignments${qs({ classId, status })}`, [classId, status]);
  const { data: cls } = useApi(classId ? `/academic/classes/${classId}` : null, [classId]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({
    classId: '',
    subjectId: '',
    title: '',
    instructions: '',
    dueAt: '',
    maxScore: '',
    status: 'PUBLISHED',
  });
  useEffect(() => {
    if (classes.length && !classId) setClassId(classes[0].id);
  }, [classes, classId]);
  const { data: formClass } = useApi(f.classId ? `/academic/classes/${f.classId}` : null, [f.classId]);

  const create = async () => {
    setBusy(true);
    try {
      await api.post('/assignments', {
        classId: f.classId,
        subjectId: f.subjectId,
        title: f.title,
        instructions: f.instructions,
        dueAt: new Date(f.dueAt).toISOString(),
        maxScore: f.maxScore ? Number(f.maxScore) : undefined,
        status: f.status,
      });
      toast.success(
        f.status === 'PUBLISHED' ? 'Assignment published — parents and students have been notified' : 'Draft saved',
      );
      setOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Assignments & homework"
        subtitle="Publish work, track who has submitted and record grades"
        actions={
          can('ASSIGNMENTS_MANAGE') && (
            <Button
              onClick={() => {
                setF({
                  classId: classId || classes[0]?.id || '',
                  subjectId: '',
                  title: '',
                  instructions: '',
                  dueAt: '',
                  maxScore: '',
                  status: 'PUBLISHED',
                });
                setOpen(true);
              }}
            >
              <Plus size={16} /> New assignment
            </Button>
          )
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Field label="Class">
          <Select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            placeholder="All classes"
            options={classOptions(classes)}
          />
        </Field>
        <Field label="Status">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="All"
            options={['DRAFT', 'PUBLISHED', 'CLOSED'].map((s) => ({
              value: s,
              label: s.charAt(0) + s.slice(1).toLowerCase(),
            }))}
          />
        </Field>
      </div>
      <DataTable
        rows={data}
        loading={loading}
        emptyTitle="No assignments yet"
        emptyDescription="Create one to start tracking homework completion."
        columns={[
          {
            key: 'title',
            header: 'Assignment',
            render: (a: any) => (
              <div>
                <Link href={`/school/assignments/${a.id}`} className="font-medium text-brand hover:underline">
                  {a.title}
                </Link>
                <p className="text-xs text-slate-500">
                  {a.subject.name} · {a.class.name}
                </p>
              </div>
            ),
          },
          {
            key: 'dueAt',
            header: 'Due',
            render: (a: any) => (
              <span className={new Date(a.dueAt) < new Date() && a.status === 'PUBLISHED' ? 'text-red-700' : ''}>
                {fmtDateTime(a.dueAt)}
              </span>
            ),
          },
          {
            key: 'completion',
            header: 'Completion',
            className: 'w-48',
            render: (a: any) => (
              <ProgressBar
                value={a.completion}
                tone={a.completion >= 80 ? 'emerald' : a.completion >= 50 ? 'amber' : 'red'}
                label={`${(a.byStatus.SUBMITTED ?? 0) + (a.byStatus.LATE ?? 0) + (a.byStatus.GRADED ?? 0)} of ${a.total}`}
              />
            ),
          },
          {
            key: 'toGrade',
            header: 'To grade',
            align: 'right',
            render: (a: any) => (a.byStatus.SUBMITTED ?? 0) + (a.byStatus.LATE ?? 0),
          },
          { key: 'status', header: 'Status', render: (a: any) => <Badge>{a.status}</Badge> },
        ]}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New assignment"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} loading={busy} disabled={!f.classId || !f.subjectId || !f.title || !f.dueAt}>
              {f.status === 'PUBLISHED' ? 'Publish' : 'Save draft'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Class">
            <Select
              value={f.classId}
              onChange={(e) => setF({ ...f, classId: e.target.value, subjectId: '' })}
              placeholder="Select"
              options={classOptions(classes)}
            />
          </Field>
          <Field label="Subject">
            <Select
              value={f.subjectId}
              onChange={(e) => setF({ ...f, subjectId: e.target.value })}
              placeholder="Select"
              options={(formClass?.subjects ?? []).map((s: any) => ({ value: s.subjectId, label: s.subject.name }))}
            />
          </Field>
          <Field label="Title" className="sm:col-span-2">
            <Input
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
              placeholder="Fractions worksheet 4"
            />
          </Field>
          <Field label="Instructions" className="sm:col-span-2">
            <Textarea
              className="min-h-[120px]"
              value={f.instructions}
              onChange={(e) => setF({ ...f, instructions: e.target.value })}
            />
          </Field>
          <Field label="Due">
            <Input type="datetime-local" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} />
          </Field>
          <Field label="Max score (optional)">
            <Input type="number" value={f.maxScore} onChange={(e) => setF({ ...f, maxScore: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value })}
              options={[
                { value: 'PUBLISHED', label: 'Publish now (notifies parents & students)' },
                { value: 'DRAFT', label: 'Save as draft' },
              ]}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
