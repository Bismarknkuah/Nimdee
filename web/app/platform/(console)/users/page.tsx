'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { ago } from '@/lib/format';
import { Badge, Button, DataTable, Field, Input, Modal, PageHeader, Select, useToast } from '@/components/ui';

export default function PlatformUsers() {
  const toast = useToast();
  const { data, loading, reload } = useApi<any[]>('/platform/users');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ email: '', name: '', role: 'SUPPORT' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api.post('/platform/users', f);
      alert(`User created.\nEmail: ${r.email}\nTemporary password: ${r.temporaryPassword}`);
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
        title="Platform users"
        subtitle="Owners and support staff of the platform"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> New user
          </Button>
        }
      />
      <DataTable
        rows={data}
        loading={loading}
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (u: any) => (
              <div>
                <p className="font-medium">{u.name}</p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
            ),
          },
          { key: 'role', header: 'Role', render: (u: any) => <Badge tone="brand">{u.role}</Badge> },
          {
            key: 'lastLoginAt',
            header: 'Last login',
            render: (u: any) => (u.lastLoginAt ? ago(u.lastLoginAt) : 'never'),
          },
          {
            key: 'isActive',
            header: 'Status',
            render: (u: any) => <Badge>{u.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>,
          },
          {
            key: 'x',
            header: '',
            render: (u: any) => (
              <button
                className="text-xs text-brand hover:underline"
                onClick={async () => {
                  try {
                    await api.patch(`/platform/users/${u.id}`, { isActive: !u.isActive });
                    reload();
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
              >
                {u.isActive ? 'Deactivate' : 'Activate'}
              </button>
            ),
          },
        ]}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New platform user"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Role">
            <Select
              value={f.role}
              onChange={(e) => setF({ ...f, role: e.target.value })}
              options={[
                { value: 'SUPPORT', label: 'Support' },
                { value: 'SUPER_ADMIN', label: 'Super admin' },
              ]}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
