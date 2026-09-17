'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Calculator, Plus } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useAcademic, classOptions } from '@/lib/academic';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { Alert, Badge, Button, DataTable, Field, Input, Modal, PageHeader, Select, useToast } from '@/components/ui';

/** Assessments per term/class: create, enter marks, compute result sheets. */
export default function ResultsPage() {
  const toast = useToast();
  const { can, role } = useAuth();
  const { term, terms, classes: all } = useAcademic();
  const { data: mine } = useApi(role === 'teacher' ? '/staff/my-classes' : null);
  const classes = useMemo(() => {
    if (role !== 'teacher' || can('ACADEMIC_MANAGE') || !mine) return all;
    const ids = new Set<string>([
      ...mine.classTeacherOf.map((c: any) => c.id),
      ...mine.teaching.map((t: any) => t.classId),
    ]);
    return all.filter((c) => ids.has(c.id));
  }, [all, mine, role, can]);
  const [termId, setTermId] = useState('');
  const [classId, setClassId] = useState('');
  useEffect(() => {
    if (term && !termId) setTermId(term.id);
  }, [term, termId]);
  useEffect(() => {
    if (classes.length && !classId) setClassId(classes[0].id);
  }, [classes, classId]);
  const {
    data: assessments,
    loading,
    reload,
  } = useApi(termId && classId ? `/results/assessments${qs({ termId, classId })}` : null, [termId, classId]);
  const { data: cls } = useApi(classId ? `/academic/classes/${classId}` : null, [classId]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({ subjectId: '', name: '', type: 'CA', maxScore: 100, weight: 1, date: '' });
  const create = async () => {
    setBusy(true);
    try {
      await api.post('/results/assessments', {
        termId,
        classId,
        subjectId: f.subjectId,
        name: f.name,
        type: f.type,
        maxScore: Number(f.maxScore),
        weight: Number(f.weight),
        date: f.date || undefined,
      });
      toast.success('Assessment created');
      setOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const compute = async () => {
    setBusy(true);
    try {
      const r = await api.post('/results/compute', { termId, classId });
      toast.success(
        `Computed ${r.computed} result sheet(s)${r.skipped ? ` (${r.skipped} published sheets skipped)` : ''}`,
      );
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const subjectOptions = (cls?.subjects ?? []).map((s: any) => ({ value: s.subjectId, label: s.subject.name }));
  return (
    <div>
      <PageHeader
        title="Results & assessments"
        subtitle="Create assessments, enter marks, then compute and publish result sheets"
        actions={
          <>
            <Link href={`/school/results/sheets${qs({ termId, classId })}`} className="btn-secondary">
              Result sheets
            </Link>
            {can('RESULT_ENTER') && (
              <Button variant="secondary" onClick={compute} loading={busy} disabled={!assessments?.length}>
                <Calculator size={16} /> Compute results
              </Button>
            )}
            {can('RESULT_ENTER') && (
              <Button onClick={() => setOpen(true)} disabled={!classId}>
                <Plus size={16} /> New assessment
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label="Term">
          <Select
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
            options={terms.map((t: any) => ({ value: t.id, label: t.name }))}
          />
        </Field>
        <Field label="Class">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)} options={classOptions(classes)} />
        </Field>
      </div>
      {assessments && !assessments.length && (
        <Alert kind="info" className="mb-4">
          No assessments yet for this class and term. Create class tests (CA) and an exam per subject, enter marks, then
          compute results.
        </Alert>
      )}
      <DataTable
        rows={assessments}
        loading={loading}
        columns={[
          {
            key: 'name',
            header: 'Assessment',
            render: (a: any) => (
              <Link href={`/school/results/assessments/${a.id}`} className="font-medium text-brand hover:underline">
                {a.name}
              </Link>
            ),
          },
          { key: 'subject', header: 'Subject', render: (a: any) => a.subject.name },
          {
            key: 'type',
            header: 'Type',
            render: (a: any) => <Badge tone={a.type === 'EXAM' ? 'brand' : 'slate'}>{a.type}</Badge>,
          },
          { key: 'maxScore', header: 'Max score', align: 'right', render: (a: any) => Number(a.maxScore) },
          { key: 'weight', header: 'Weight', align: 'right', render: (a: any) => Number(a.weight) },
          { key: 'date', header: 'Date', render: (a: any) => fmtDate(a.date) },
          { key: 'marksEntered', header: 'Marks entered', align: 'right' },
          {
            key: 'x',
            header: '',
            render: (a: any) => (
              <Link href={`/school/results/assessments/${a.id}`} className="text-xs text-brand hover:underline">
                Enter marks →
              </Link>
            ),
          },
        ]}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New assessment"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} loading={busy}>
              Create
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Subject" className="sm:col-span-2">
            <Select
              value={f.subjectId}
              onChange={(e) => setF({ ...f, subjectId: e.target.value })}
              placeholder="Select subject"
              options={subjectOptions}
            />
          </Field>
          <Field label="Name">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Class test 1" />
          </Field>
          <Field label="Type" hint="CA/project/practical count towards the class score; EXAM towards the exam score">
            <Select
              value={f.type}
              onChange={(e) => setF({ ...f, type: e.target.value })}
              options={['CA', 'EXAM', 'PROJECT', 'PRACTICAL'].map((t) => ({ value: t, label: t }))}
            />
          </Field>
          <Field label="Max score">
            <Input type="number" value={f.maxScore} onChange={(e) => setF({ ...f, maxScore: e.target.value })} />
          </Field>
          <Field label="Weight" hint="Relative weight among assessments of the same kind">
            <Input type="number" step="0.1" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} />
          </Field>
          <Field label="Date">
            <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
