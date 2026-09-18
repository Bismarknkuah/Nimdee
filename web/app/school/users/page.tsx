'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { ago, title } from '@/lib/format';
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
  SearchBox,
  Select,
  Tabs,
  useToast,
} from '@/components/ui';

function UsersTab() {
  const toast = useToast();
  const { me } = useAuth();
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useApi(`/users${qs({ search: q, page, pageSize: 25 })}`, [q, page]);
  const roles = useApi<any[]>('/roles');
  const [modal, setModal] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({});
  const save = async () => {
    setBusy(true);
    try {
      if (modal.id)
        await api.patch(`/users/${modal.id}`, {
          firstName: f.firstName,
          lastName: f.lastName,
          phone: f.phone || undefined,
          isActive: f.isActive,
          roleIds: f.roleIds,
        });
      else {
        const r = await api.post('/users', { ...f, phone: f.phone || undefined });
        alert(`Login created.\nEmail: ${r.email}\nTemporary password: ${r.temporaryPassword}`);
      }
      toast.success('Saved');
      setModal(null);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const reset = async (u: any) => {
    if (!confirm(`Reset password for ${u.email}?`)) return;
    try {
      const r = await api.post(`/users/${u.id}/reset-password`);
      alert(`Temporary password for ${u.email}: ${r.temporaryPassword}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <div>
      <div className="mb-4 flex items-end gap-3">
        <div className="w-80">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
          />
        </div>
        <div className="ml-auto">
          <Button
            onClick={() => {
              setF({ email: '', firstName: '', lastName: '', phone: '', userType: 'STAFF', roleIds: [] });
              setModal({});
            }}
          >
            <Plus size={16} /> New user
          </Button>
        </div>
      </div>
      <DataTable
        rows={data?.items}
        loading={loading}
        page={page}
        pageSize={25}
        total={data?.total}
        onPage={setPage}
        columns={[
          {
            key: 'name',
            header: 'User',
            render: (u: any) => (
              <div>
                <p className="font-medium">
                  {u.firstName} {u.lastName}
                </p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
            ),
          },
          { key: 'userType', header: 'Type', render: (u: any) => title(u.userType) },
          {
            key: 'roles',
            header: 'Roles',
            render: (u: any) =>
              u.roles.map((r: any) => (
                <Badge key={r.id} tone="slate" className="mr-1">
                  {r.name}
                </Badge>
              )),
          },
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
              <div className="flex gap-2 text-xs">
                <button
                  className="text-brand hover:underline"
                  onClick={() => {
                    setF({
                      firstName: u.firstName,
                      lastName: u.lastName,
                      phone: u.phone ?? '',
                      isActive: u.isActive,
                      roleIds: u.roles.map((r: any) => r.id),
                    });
                    setModal(u);
                  }}
                >
                  Edit
                </button>
                {u.id !== me?.user.id && (
                  <button className="text-brand hover:underline" onClick={() => reset(u)}>
                    Reset password
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? 'Edit user' : 'New user'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy} disabled={!f.roleIds?.length}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {!modal?.id && (
            <Field label="Email" className="sm:col-span-2">
              <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </Field>
          )}          <Field label="First name">
            <Input value={f.firstName ?? ''} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <Input value={f.lastName ?? ''} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          {!modal?.id && (
            <Field label="Temporary password" hint="Leave blank to auto-generate one, shown once on save">
              <Input
                type="text"
                value={f.password ?? ''}
                onChange={(e) => setF({ ...f, password: e.target.value })}
                placeholder="Auto-generated"
              />
            </Field>
          )}
          {!modal?.id ? (
            <Field label="User type">
              <Select
                value={f.userType}
                onChange={(e) => setF({ ...f, userType: e.target.value })}
                options={['STAFF', 'TEACHER', 'PARENT', 'STUDENT'].map((t) => ({ value: t, label: title(t) }))}
              />
            </Field>
          ) : (
            <div className="flex items-end pb-2">
              <Checkbox
                label="Account active"
                checked={!!f.isActive}
                onChange={(e) => setF({ ...f, isActive: e.target.checked })}
              />
            </div>
          )}
        </div>
        <p className="label mt-3">Roles</p>
        <div className="grid grid-cols-2 gap-1">
          {(roles.data ?? []).map((r) => (
            <Checkbox
              key={r.id}
              label={r.name}
              checked={f.roleIds?.includes(r.id)}
              onChange={(e) =>
                setF({
                  ...f,
                  roleIds: e.target.checked ? [...f.roleIds, r.id] : f.roleIds.filter((x: string) => x !== r.id),
                })
              }
            />
          ))}
        </div>
      </Modal>
    </div>
  );
}

function RolesTab() {
  const toast = useToast();
  const { can } = useAuth();
  const { data, loading, reload } = useApi<any[]>('/roles');
  const { data: catalog } = useApi('/roles/permissions');
  const [modal, setModal] = useState<any>(null);
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      if (modal.id) await api.patch(`/roles/${modal.id}`, f);
      else await api.post('/roles', f);
      toast.success('Saved');
      setModal(null);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = (p: string) =>
    setF({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter((x: string) => x !== p) : [...f.permissions, p],
    });
  return (
    <div>
      {can('ROLES_MANAGE') && (
        <div className="mb-3 flex justify-end">
          <Button
            onClick={() => {
              setF({ name: '', description: '', permissions: [] });
              setModal({});
            }}
          >
            <Plus size={16} /> New role
          </Button>
        </div>
      )}
      <DataTable
        rows={data}
        loading={loading}
        columns={[
          {
            key: 'name',
            header: 'Role',
            render: (r: any) => (
              <span className="font-medium">
                {r.name} {r.isSystem && <Badge tone="slate">System</Badge>}
              </span>
            ),
          },
          { key: 'description', header: 'Description' },
          {
            key: 'permissions',
            header: 'Permissions',
            render: (r: any) =>
              r.permissions.includes('*') ? (
                <Badge tone="brand">All permissions</Badge>
              ) : (
                `${r.permissions.length} permissions`
              ),
          },
          { key: 'userCount', header: 'Users', align: 'right' },
          {
            key: 'x',
            header: '',
            render: (r: any) =>
              can('ROLES_MANAGE') && (
                <div className="flex gap-2 text-xs">
                  {r.name !== 'School Admin' && (
                    <button
                      className="text-brand hover:underline"
                      onClick={() => {
                        setF({ name: r.name, description: r.description ?? '', permissions: r.permissions });
                        setModal(r);
                      }}
                    >
                      Edit
                    </button>
                  )}
                  {!r.isSystem && (
                    <button
                      className="text-red-600 hover:underline"
                      onClick={async () => {
                        if (!confirm(`Delete role ${r.name}?`)) return;
                        try {
                          await api.delete(`/roles/${r.id}`);
                          reload();
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ),
          },
        ]}
      />
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? `Edit ${modal.name}` : 'New role'}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy} disabled={!f.name}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input
              value={f.name ?? ''}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              disabled={modal?.isSystem}
            />
          </Field>
          <Field label="Description">
            <Input value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(catalog?.groups ?? {}).map(([group, perms]: any) => (
            <Card key={group} title={title(group)}>
              <div className="space-y-1">
                {perms.map((p: string) => (
                  <Checkbox
                    key={p}
                    label={title(p)}
                    checked={!!f.permissions?.includes(p)}
                    onChange={() => toggle(p)}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export default function UsersPage() {
  const [tab, setTab] = useState('users');
  return (
    <div>
      <PageHeader title="Users & roles" subtitle="Who can sign in and what they can do" />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'users', label: 'Users' },
          { id: 'roles', label: 'Roles & permissions' },
        ]}
      />
      {tab === 'users' ? <UsersTab /> : <RolesTab />}
    </div>
  );
}
