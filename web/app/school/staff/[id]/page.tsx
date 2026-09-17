'use client';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate, title } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  Description,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  useToast,
} from '@/components/ui';

export default function StaffDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();
  const { data: s, loading, reload } = useApi(`/staff/${id}`);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState<any>({});
  if (loading || !s) return <Spinner />;
  const save = async () => {
    try {
      const body = { ...f };
      Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
      await api.patch(`/staff/${id}`, body);
      toast.success('Saved');
      setEdit(false);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const createLogin = async () => {
    const email = s.email || prompt('Email address for the login');
    if (!email) return;
    try {
      const r = await api.post(`/staff/${id}/login`, { email });
      alert(`Login created.\nEmail: ${r.email}\nTemporary password: ${r.temporaryPassword}`);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <div>
      <PageHeader
        back={() => router.back()}
        title={
          <>
            {s.firstName} {s.lastName} <Badge>{s.status}</Badge>
          </>
        }
        subtitle={`${s.employeeId} · ${s.position ?? title(s.staffType)}`}
        actions={
          <>
            {can('USERS_MANAGE') && !s.user && (
              <Button variant="secondary" onClick={createLogin}>
                <KeyRound size={16} /> Create login
              </Button>
            )}
            {can('STAFF_MANAGE') && (
              <Button
                onClick={() => {
                  setF({
                    firstName: s.firstName,
                    lastName: s.lastName,
                    phone: s.phone ?? '',
                    email: s.email ?? '',
                    department: s.department ?? '',
                    position: s.position ?? '',
                    status: s.status,
                  });
                  setEdit(true);
                }}
              >
                Edit
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Profile" className="lg:col-span-2">
          <Description
            items={[
              ['Staff type', title(s.staffType)],
              ['Gender', s.gender ?? null],
              ['Phone', s.phone],
              ['Email', s.email],
              ['Department', s.department],
              ['Employment date', fmtDate(s.employmentDate)],
              ['Portal login', s.user ? `${s.user.email} (${s.user.isActive ? 'active' : 'disabled'})` : 'None'],
            ]}
          />
        </Card>
        <Card title="Teaching">
          <p className="text-xs font-medium text-slate-500">Class teacher of</p>
          <p className="text-sm">
            {s.classTeacherOf.length ? s.classTeacherOf.map((c: any) => c.name).join(', ') : '—'}
          </p>
          <p className="mt-3 text-xs font-medium text-slate-500">Subjects</p>
          <ul className="text-sm">
            {s.classSubjects.map((cs: any) => (
              <li key={cs.id}>
                {cs.subject.name} · {cs.class.name}
              </li>
            ))}
            {!s.classSubjects.length && <li className="text-slate-400">No subject assignments</li>}
          </ul>
        </Card>
      </div>
      <Modal
        open={edit}
        onClose={() => setEdit(false)}
        title="Edit staff"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['firstName', 'First name'],
            ['lastName', 'Last name'],
            ['phone', 'Phone'],
            ['email', 'Email'],
            ['department', 'Department'],
            ['position', 'Position'],
          ].map(([k, l]) => (
            <Field key={k} label={l}>
              <Input value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </Field>
          ))}
          <Field label="Status">
            <Select
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value })}
              options={['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'].map((v) => ({ value: v, label: title(v) }))}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
