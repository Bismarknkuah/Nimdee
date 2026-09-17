'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, openBlob } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { Avatar, Button, Card, Field, Input, Modal, PageHeader, Select, Spinner, useToast } from '@/components/ui';

export default function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();
  const { data: c, loading, reload } = useApi(`/academic/classes/${id}`);
  const subjects = useApi<any[]>('/academic/subjects');
  const staff = useApi('/staff?pageSize=200&staffType=TEACHING');
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const [moveTo, setMoveTo] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const classes = useApi<any[]>('/academic/classes');
  useEffect(() => {
    if (c) setRows(c.subjects.map((s: any) => ({ subjectId: s.subjectId, teacherId: s.teacherId ?? '' })));
  }, [c]);
  if (loading || !c) return <Spinner />;
  const teachers = (staff.data?.items ?? []).map((s: any) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }));
  const saveSubjects = async () => {
    try {
      await api.put(`/academic/classes/${id}/subjects`, {
        subjects: rows
          .filter((r) => r.subjectId)
          .map((r) => ({ subjectId: r.subjectId, teacherId: r.teacherId || null })),
      });
      toast.success('Subjects updated');
      setOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const saveEdit = async () => {
    try {
      await api.patch(`/academic/classes/${id}`, {
        ...edit,
        capacity: edit.capacity ? Number(edit.capacity) : undefined,
        classTeacherId: edit.classTeacherId || null,
      });
      toast.success('Class updated');
      setEdit(null);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const promote = async () => {
    if (!moveTo || !selected.length) return;
    try {
      const r = await api.post('/students/promote', { studentIds: selected, toClassId: moveTo });
      toast.success(`${r.moved} student(s) moved`);
      setSelected([]);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <div>
      <PageHeader
        back={() => router.back()}
        title={c.name}
        subtitle={`${c.level}${c.stream ? ` · Stream ${c.stream}` : ''} · ${c.students.length} students${c.capacity ? ` of ${c.capacity}` : ''} · Class teacher: ${c.classTeacher ? `${c.classTeacher.firstName} ${c.classTeacher.lastName}` : 'unassigned'}`}
        actions={
          <>
            <Link href={`/school/attendance?classId=${id}`} className="btn-secondary">
              Attendance
            </Link>
            <Button variant="secondary" onClick={() => openBlob(`/documents/classes/${id}/list.pdf`)}>
              Class list PDF
            </Button>
            <Button variant="secondary" onClick={() => openBlob(`/documents/classes/${id}/register.pdf`)}>
              Register PDF
            </Button>
            <Button variant="secondary" onClick={() => openBlob(`/documents/students/id-cards.pdf?classId=${id}`)}>
              ID cards PDF
            </Button>
            <Link href={`/school/timetable?classId=${id}`} className="btn-secondary">
              Timetable
            </Link>
            {can('ACADEMIC_MANAGE') && (
              <Button
                onClick={() =>
                  setEdit({
                    name: c.name,
                    level: c.level,
                    stream: c.stream ?? '',
                    capacity: c.capacity ?? '',
                    classTeacherId: c.classTeacherId ?? '',
                  })
                }
              >
                Edit class
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          title="Subjects & teachers"
          actions={
            can('ACADEMIC_MANAGE') && (
              <Button variant="secondary" onClick={() => setOpen(true)}>
                Assign
              </Button>
            )
          }
          padded={false}
        >
          <table className="table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Teacher</th>
              </tr>
            </thead>
            <tbody>
              {c.subjects.map((s: any) => (
                <tr key={s.id}>
                  <td>
                    {s.subject.name} <span className="text-xs text-slate-400">{s.subject.code}</span>
                  </td>
                  <td>
                    {s.teacher ? (
                      `${s.teacher.firstName} ${s.teacher.lastName}`
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!c.subjects.length && (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-slate-500">
                    No subjects assigned
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <Card
          title="Students"
          className="lg:col-span-2"
          padded={false}
          actions={
            can('STUDENT_EDIT') &&
            selected.length > 0 && (
              <div className="flex items-center gap-2">
                <Select
                  value={moveTo}
                  onChange={(e) => setMoveTo(e.target.value)}
                  placeholder="Move to…"
                  options={(classes.data ?? []).filter((k) => k.id !== id).map((k) => ({ value: k.id, label: k.name }))}
                />
                <Button onClick={promote}>Move {selected.length}</Button>
              </div>
            )
          }
        >
          <table className="table">
            <thead>
              <tr>
                {can('STUDENT_EDIT') && (
                  <th>
                    <input
                      type="checkbox"
                      checked={selected.length === c.students.length && c.students.length > 0}
                      onChange={(e) => setSelected(e.target.checked ? c.students.map((s: any) => s.id) : [])}
                    />
                  </th>
                )}
                <th>Student</th>
                <th>ID</th>
                <th>Gender</th>
              </tr>
            </thead>
            <tbody>
              {c.students.map((s: any) => (
                <tr key={s.id}>
                  {can('STUDENT_EDIT') && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(s.id)}
                        onChange={(e) =>
                          setSelected(e.target.checked ? [...selected, s.id] : selected.filter((x) => x !== s.id))
                        }
                      />
                    </td>
                  )}
                  <td>
                    <Link href={`/school/students/${s.id}`} className="flex items-center gap-2 hover:underline">
                      <Avatar name={`${s.firstName} ${s.lastName}`} src={s.photoUrl} size="sm" />
                      {s.firstName} {s.lastName}
                    </Link>
                  </td>
                  <td className="text-xs text-slate-500">{s.studentId}</td>
                  <td>{s.gender[0] + s.gender.slice(1).toLowerCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Assign subjects"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRows([...rows, { subjectId: '', teacherId: '' }])}>
              Add row
            </Button>
            <Button onClick={saveSubjects}>Save</Button>
          </>
        }
      >
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2">
              <Select
                className="flex-1"
                value={r.subjectId}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, subjectId: e.target.value } : x)))}
                placeholder="Subject"
                options={(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              />
              <Select
                className="flex-1"
                value={r.teacherId}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, teacherId: e.target.value } : x)))}
                placeholder="No teacher"
                options={teachers}
              />
              <button className="btn-ghost text-red-600" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          ))}
          {!rows.length && <p className="text-sm text-slate-500">No subjects. Click “Add row”.</p>}
        </div>
      </Modal>
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title="Edit class"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save</Button>
          </>
        }
      >
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Level">
              <Input value={edit.level} onChange={(e) => setEdit({ ...edit, level: e.target.value })} />
            </Field>
            <Field label="Stream">
              <Input value={edit.stream} onChange={(e) => setEdit({ ...edit, stream: e.target.value })} />
            </Field>
            <Field label="Capacity">
              <Input
                type="number"
                value={edit.capacity}
                onChange={(e) => setEdit({ ...edit, capacity: e.target.value })}
              />
            </Field>
            <Field label="Class teacher" className="sm:col-span-2">
              <Select
                value={edit.classTeacherId}
                onChange={(e) => setEdit({ ...edit, classTeacherId: e.target.value })}
                placeholder="Unassigned"
                options={teachers}
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
