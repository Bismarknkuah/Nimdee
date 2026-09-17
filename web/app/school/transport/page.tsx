'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Bus, Plus } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  KeyStat,
  Modal,
  PageHeader,
  ProgressBar,
  SearchBox,
  Select,
  useToast,
} from '@/components/ui';

/** Transport: routes, stops, vehicles and the students riding each bus. */
export default function TransportPage() {
  const toast = useToast();
  const { can, me } = useAuth();
  const cur = me?.tenant?.currency ?? 'GHS';
  const { data: routes, loading, reload } = useApi<any[]>('/transport/routes');
  const [sel, setSel] = useState<string | null>(null);
  const { data: route, reload: reloadRoute } = useApi(sel ? `/transport/routes/${sel}` : null, [sel]);
  const [modal, setModal] = useState<string | null>(null);
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const { data: students } = useApi(q.length >= 2 ? `/students${qs({ search: q, pageSize: 6 })}` : null, [q]);
  const all = () => {
    reload();
    reloadRoute();
  };
  const saveRoute = async () => {
    setBusy(true);
    try {
      const body = {
        ...f,
        capacity: f.capacity ? Number(f.capacity) : undefined,
        termFee: f.termFee !== '' && f.termFee !== undefined ? Number(f.termFee) : undefined,
      };
      delete body.id;
      Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
      if (f.id) await api.patch(`/transport/routes/${f.id}`, body);
      else {
        const r = await api.post('/transport/routes', body);
        setSel(r.id);
      }
      toast.success('Route saved');
      setModal(null);
      all();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const saveStop = async () => {
    setBusy(true);
    try {
      if (f.id)
        await api.patch(`/transport/stops/${f.id}`, {
          name: f.name,
          pickupTime: f.pickupTime || undefined,
          dropoffTime: f.dropoffTime || undefined,
          sequence: f.sequence ? Number(f.sequence) : undefined,
        });
      else
        await api.post(`/transport/routes/${sel}/stops`, {
          name: f.name,
          pickupTime: f.pickupTime || undefined,
          dropoffTime: f.dropoffTime || undefined,
        });
      toast.success('Stop saved');
      setModal(null);
      all();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const assign = async () => {
    setBusy(true);
    try {
      await api.post('/transport/assignments', { studentId: f.studentId, routeId: sel, stopId: f.stopId || undefined });
      toast.success('Student added to route');
      setModal(null);
      all();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const unassign = async (studentId: string) => {
    if (!confirm('Remove this student from the route?')) return;
    try {
      await api.delete(`/transport/assignments/${studentId}`);
      all();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const totalRiders = (routes ?? []).reduce((a, r) => a + r.riders, 0),
    totalSeats = (routes ?? []).reduce((a, r) => a + (r.capacity ?? 0), 0);
  return (
    <div>
      <PageHeader
        title="Transport"
        subtitle="Bus routes, stops, drivers and riders"
        actions={
          can('TRANSPORT_MANAGE') && (
            <Button
              onClick={() => {
                setF({
                  name: '',
                  description: '',
                  vehicle: '',
                  driverName: '',
                  driverPhone: '',
                  capacity: '',
                  termFee: '',
                  isActive: true,
                });
                setModal('route');
              }}
            >
              <Plus size={16} /> New route
            </Button>
          )
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <KeyStat label="Routes" value={routes?.length ?? 0} />
        <KeyStat label="Students riding" value={totalRiders} tone="brand" />
        <KeyStat
          label="Seats"
          value={totalSeats}
          sub={totalSeats ? `${Math.round((totalRiders / totalSeats) * 100)}% occupied` : undefined}
        />
        <KeyStat label="Active routes" value={(routes ?? []).filter((r) => r.isActive).length} tone="emerald" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3">
          {loading && <Card>Loading…</Card>}
          {(routes ?? []).map((r) => (
            <button
              key={r.id}
              onClick={() => setSel(r.id)}
              className={`card w-full p-4 text-left hover:border-brand ${sel === r.id ? 'border-brand ring-2 ring-brand/20' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-500">
                    {r.vehicle ?? 'No vehicle'} · {r.driverName ?? 'No driver'}
                  </p>
                </div>
                {!r.isActive && <Badge tone="slate">INACTIVE</Badge>}
              </div>
              <div className="mt-2">
                <ProgressBar
                  value={r.occupancy ?? 0}
                  tone={(r.occupancy ?? 0) > 90 ? 'red' : 'brand'}
                  label={`${r.riders}${r.capacity ? ` / ${r.capacity}` : ''} riders`}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {r.stops.length} stops{r.termFee ? ` · ${money(r.termFee, cur)}/term` : ''}
              </p>
            </button>
          ))}
          {routes && !routes.length && (
            <Card>
              <EmptyState title="No routes yet" description="Create a route, add its stops, then assign students." />
            </Card>
          )}
        </div>
        <div className="lg:col-span-2">
          {route ? (
            <div className="space-y-4">
              <Card
                title={
                  <span className="flex items-center gap-2">
                    <Bus size={16} /> {route.name}
                  </span>
                }
                actions={
                  can('TRANSPORT_MANAGE') && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setF({
                          ...route,
                          capacity: route.capacity ?? '',
                          termFee: route.termFee ?? '',
                          description: route.description ?? '',
                          vehicle: route.vehicle ?? '',
                          driverName: route.driverName ?? '',
                          driverPhone: route.driverPhone ?? '',
                        });
                        setModal('route');
                      }}
                    >
                      Edit route
                    </Button>
                  )
                }
              >
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-slate-500">Vehicle</p>
                    <p>{route.vehicle ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Driver</p>
                    <p>
                      {route.driverName ?? '—'}
                      {route.driverPhone ? ` · ${route.driverPhone}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Fee per term</p>
                    <p>{route.termFee ? money(route.termFee, cur) : '—'}</p>
                  </div>
                </div>
                {route.description && <p className="mt-2 text-sm text-slate-600">{route.description}</p>}
              </Card>
              <Card
                title="Stops"
                padded={false}
                actions={
                  can('TRANSPORT_MANAGE') && (
                    <button
                      className="text-xs text-brand hover:underline"
                      onClick={() => {
                        setF({ name: '', pickupTime: '', dropoffTime: '' });
                        setModal('stop');
                      }}
                    >
                      Add stop
                    </button>
                  )
                }
              >
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Stop</th>
                      <th>Pick-up</th>
                      <th>Drop-off</th>
                      <th className="text-right">Riders</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {route.stops.map((s: any) => (
                      <tr key={s.id}>
                        <td>{s.sequence}</td>
                        <td className="font-medium">{s.name}</td>
                        <td>{s.pickupTime ?? '—'}</td>
                        <td>{s.dropoffTime ?? '—'}</td>
                        <td className="text-right">{route.assignments.filter((a: any) => a.stopId === s.id).length}</td>
                        <td className="text-right text-xs">
                          {can('TRANSPORT_MANAGE') && (
                            <>
                              <button
                                className="text-brand hover:underline"
                                onClick={() => {
                                  setF({ ...s, pickupTime: s.pickupTime ?? '', dropoffTime: s.dropoffTime ?? '' });
                                  setModal('stop');
                                }}
                              >
                                Edit
                              </button>{' '}
                              <button
                                className="ml-2 text-red-600 hover:underline"
                                onClick={async () => {
                                  if (confirm('Delete stop?')) {
                                    await api.delete(`/transport/stops/${s.id}`);
                                    all();
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!route.stops.length && (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-500">
                          No stops yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
              <Card
                title={`Riders (${route.riders}${route.capacity ? ` of ${route.capacity}` : ''})`}
                padded={false}
                actions={
                  can('TRANSPORT_MANAGE') && (
                    <button
                      className="text-xs text-brand hover:underline"
                      onClick={() => {
                        setF({ studentId: '', studentName: '', stopId: '' });
                        setModal('assign');
                      }}
                    >
                      Add student
                    </button>
                  )
                }
              >
                <table className="table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Class</th>
                      <th>Stop</th>
                      <th>Guardian</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {route.assignments.map((a: any) => (
                      <tr key={a.id}>
                        <td>
                          <Link href={`/school/students/${a.student.id}`} className="font-medium hover:underline">
                            {a.student.firstName} {a.student.lastName}
                          </Link>{' '}
                          <span className="text-xs text-slate-500">{a.student.studentId}</span>
                        </td>
                        <td>{a.student.class?.name}</td>
                        <td>{a.stop?.name ?? '—'}</td>
                        <td className="text-xs">
                          {a.student.guardians[0]
                            ? `${a.student.guardians[0].guardian.firstName} ${a.student.guardians[0].guardian.lastName} · ${a.student.guardians[0].guardian.phone}`
                            : '—'}
                        </td>
                        <td className="text-right">
                          {can('TRANSPORT_MANAGE') && (
                            <button
                              className="text-xs text-red-600 hover:underline"
                              onClick={() => unassign(a.student.id)}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!route.assignments.length && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-500">
                          No students on this route
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
            </div>
          ) : (
            <Card>
              <EmptyState
                title="Select a route"
                description="Choose a route on the left to see its stops and riders."
              />
            </Card>
          )}
        </div>
      </div>
      <Modal
        open={modal === 'route'}
        onClose={() => setModal(null)}
        title={f.id ? 'Edit route' : 'New route'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={saveRoute} loading={busy} disabled={!f.name}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['name', 'Route name'],
            ['vehicle', 'Vehicle / plate'],
            ['driverName', 'Driver'],
            ['driverPhone', 'Driver phone'],
            ['capacity', 'Seats'],
            ['termFee', `Fee per term (${cur})`],
          ].map(([k, l]) => (
            <Field key={k} label={l}>
              <Input value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </Field>
          ))}
          <Field label="Description" className="sm:col-span-2">
            <Input value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox
              label="Route is active"
              checked={!!f.isActive}
              onChange={(e) => setF({ ...f, isActive: e.target.checked })}
            />
          </div>
        </div>
      </Modal>
      <Modal
        open={modal === 'stop'}
        onClose={() => setModal(null)}
        title={f.id ? 'Edit stop' : 'Add stop'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={saveStop} loading={busy} disabled={!f.name}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="Stop name">
            <Input value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pick-up time">
              <Input
                type="time"
                value={f.pickupTime ?? ''}
                onChange={(e) => setF({ ...f, pickupTime: e.target.value })}
              />
            </Field>
            <Field label="Drop-off time">
              <Input
                type="time"
                value={f.dropoffTime ?? ''}
                onChange={(e) => setF({ ...f, dropoffTime: e.target.value })}
              />
            </Field>
          </div>
          {f.id && (
            <Field label="Sequence">
              <Input
                type="number"
                value={f.sequence ?? ''}
                onChange={(e) => setF({ ...f, sequence: e.target.value })}
              />
            </Field>
          )}
        </div>
      </Modal>
      <Modal
        open={modal === 'assign'}
        onClose={() => setModal(null)}
        title="Add student to route"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={assign} loading={busy} disabled={!f.studentId}>
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Student">
            {f.studentId ? (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{f.studentName}</span>
                <button className="text-xs text-brand" onClick={() => setF({ ...f, studentId: '' })}>
                  Change
                </button>
              </div>
            ) : (
              <>
                <SearchBox value={search} onChange={setSearch} placeholder="Type a name…" />
                {students?.items?.length > 0 && (
                  <ul className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {students.items.map((st: any) => (
                      <li key={st.id}>
                        <button
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          onClick={() => {
                            setF({
                              ...f,
                              studentId: st.id,
                              studentName: `${st.firstName} ${st.lastName} (${st.class?.name ?? '—'})`,
                            });
                            setSearch('');
                          }}
                        >
                          {st.firstName} {st.lastName} <span className="text-slate-500">· {st.class?.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Field>
          <Field label="Stop">
            <Select
              value={f.stopId ?? ''}
              onChange={(e) => setF({ ...f, stopId: e.target.value })}
              placeholder="Any stop"
              options={(route?.stops ?? []).map((s: any) => ({ value: s.id, label: s.name }))}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
