'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Download, UserPlus } from 'lucide-react';
import { api, downloadBlob, qs } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { title } from '@/lib/format';
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchBox,
  Select,
  useToast,
} from '@/components/ui';

export default function StaffPage() {
  const router = useRouter();
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({
    firstName: '',
    lastName: '',
    gender: 'MALE',
    phone: '',
    email: '',
    staffType: 'TEACHING',
    department: '',
    position: '',
    employmentDate: '',
    createLogin: true,
    roleName: 'Teacher',
  });
  const q = useDebounce(search);
  const { data, loading, reload } = useApi(`/staff${qs({ search: q, page, pageSize: 25 })}`);
  const { data: roles } = useApi(open ? '/roles' : null, [open]);
  const set = (k: string) => (e: any) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async () => {
    setBusy(true);
    try {
      const body: any = { ...f };
      Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
      const r = await api.post('/staff', body);
      if (r.login?.temporaryPassword)
        alert(`Staff created.\nLogin: ${r.login.email}\nTemporary password: ${r.login.temporaryPassword}`);
      toast.success(`${r.firstName} added as ${r.employeeId}`);
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
        title="Staff"
        subtitle={data ? `${data.total} staff members` : undefined}
        actions={
          <>
            {can('EXPORT_DATA') && (
              <button className="btn-secondary" onClick={() => downloadBlob('/exports/staff.csv', 'staff.csv')}>
                <Download size={16} /> Export
              </button>
            )}
            {can('STAFF_MANAGE') && (
              <Button onClick={() => setOpen(true)}>
                <UserPlus size={16} /> Add staff
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 max-w-md">
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search staff"
        />
      </div>
      <DataTable
        rows={data?.items}
        loading={loading}
        page={page}
        pageSize={25}
        total={data?.total}
        onPage={setPage}
        onRowClick={(r: any) => router.push(`/school/staff/${r.id}`)}
        columns={[
          {
            key: 'name',
            header: 'Staff',
            render: (r: any) => (
              <div className="flex items-center gap-2">
                <Avatar name={`${r.firstName} ${r.lastName}`} size="sm" />
                <div>
                  <p className="font-medium text-slate-900">
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{r.employeeId}</p>
                </div>
              </div>
            ),
          },
          { key: 'position', header: 'Position', render: (r: any) => r.position ?? title(r.staffType) },
          { key: 'department', header: 'Department', render: (r: any) => r.department ?? '—' },
          {
            key: 'classes',
            header: 'Classes',
            render: (r: any) =>
              r.classTeacherOf.length
                ? r.classTeacherOf.map((c: any) => c.name).join(', ')
                : `${r.subjectAssignments} subject assignment(s)`,
          },
          {
            key: 'roles',
            header: 'Roles',
            render: (r: any) => (r.user ? r.roles.join(', ') : <span className="text-slate-400">No login</span>),
          },
          { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
        ]}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add staff member"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={busy}>
              Add staff
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name">
            <Input value={f.firstName} onChange={set('firstName')} />
          </Field>
          <Field label="Last name">
            <Input value={f.lastName} onChange={set('lastName')} />
          </Field>
          <Field label="Gender">
            <Select
              value={f.gender}
              onChange={set('gender')}
              options={[
                { value: 'MALE', label: 'Male' },
                { value: 'FEMALE', label: 'Female' },
              ]}
            />
          </Field>
          <Field label="Staff type">
            <Select
              value={f.staffType}
              onChange={set('staffType')}
              options={[
                { value: 'TEACHING', label: 'Teaching' },
                { value: 'NON_TEACHING', label: 'Non-teaching' },
              ]}
            />
          </Field>
          <Field label="Phone">
            <Input value={f.phone} onChange={set('phone')} />
          </Field>
          <Field label="Email">
            <Input type="email" value={f.email} onChange={set('email')} />
          </Field>
          <Field label="Department">
            <Input value={f.department} onChange={set('department')} />
          </Field>
          <Field label="Position">
            <Input value={f.position} onChange={set('position')} placeholder="e.g. Class Teacher" />
          </Field>
          <Field label="Employment date">
            <Input type="date" value={f.employmentDate} onChange={set('employmentDate')} />
          </Field>
          <Field label="Portal role">
            <Select
              value={f.roleName}
              onChange={set('roleName')}
              options={(roles ?? []).map((r: any) => ({ value: r.name, label: r.name }))}
              disabled={!f.createLogin}
            />
          </Field>
        </div>
        <div className="mt-3">
          <Checkbox
            label="Create a portal login now (requires email); a temporary password will be shown once"
            checked={f.createLogin}
            onChange={set('createLogin')}
          />
        </div>
      </Modal>
    </div>
  );
}
