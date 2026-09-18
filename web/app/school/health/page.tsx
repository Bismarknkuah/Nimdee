'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HeartPulse, Plus } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime, title } from '@/lib/format';
import {
  Alert,
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

/** School clinic: sick-bay visits and confidential health records. */
export default function HealthPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [tab, setTab] = useState('visits');
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const visits = useApi(`/health/visits${qs({ search: q, type, page, pageSize: 25 })}`, [q, type, page]);
  const summary = useApi('/health/summary');
  const [modal, setModal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({});
  const [studentSearch, setStudentSearch] = useState('');
  const sq = useDebounce(studentSearch);
  const { data: students } = useApi(sq.length >= 2 ? `/students${qs({ search: sq, pageSize: 6 })}` : null, [sq]);
  const [recordStudent, setRecordStudent] = useState<string | null>(null);
  const record = useApi(recordStudent ? `/health/students/${recordStudent}` : null, [recordStudent]);
  const [rf, setRf] = useState<any>({});
  useEffect(() => {
    if (record.data) {
      const r = record.data.record ?? {};
      setRf({
        bloodGroup: r.bloodGroup ?? '',
        allergies: r.allergies ?? '',
        conditions: r.conditions ?? '',
        medications: r.medications ?? '',
        doctorName: r.doctorName ?? '',
        doctorPhone: r.doctorPhone ?? '',
        insuranceProvider: r.insuranceProvider ?? '',
        insuranceNumber: r.insuranceNumber ?? '',
        notes: r.notes ?? '',
        immunizations: (r.immunizations ?? []).map((i: any) => `${i.name}${i.date ? ` (${i.date})` : ''}`).join('\n'),
      });
    }
  }, [record.data]);
  const logVisit = async () => {
    setBusy(true);
    try {
      await api.post('/health/visits', {
        studentId: f.studentId,
        type: f.type,
        complaint: f.complaint,
        treatment: f.treatment || undefined,
        temperature: f.temperature ? Number(f.temperature) : undefined,
        referredOut: !!f.referredOut,
        notifyParent: !!f.notifyParent,
        notes: f.notes || undefined,
      });
      toast.success('Visit logged');
      setModal(null);
      visits.reload();
      summary.reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const saveRecord = async () => {
    setBusy(true);
    try {
      const body: any = {
        ...rf,
        immunizations: rf.immunizations
          ? rf.immunizations
              .split('\n')
              .map((l: string) => l.trim())
              .filter(Boolean)
              .map((l: string) => {
                const m = /^(.*?)\s*\((.*)\)$/.exec(l);
                return m ? { name: m[1], date: m[2] } : { name: l };
              })
          : [],
      };
      Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
      await api.put(`/health/students/${recordStudent}`, body);
      toast.success('Health record saved');
      record.reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const s = summary.data;
  return (
    <div>
      <PageHeader
        title="School clinic"
        subtitle="Sick-bay visits, allergies, conditions and emergency contacts, kept confidential"
        actions={
          can('HEALTH_MANAGE') && (
            <Button
              onClick={() => {
                setF({
                  studentId: '',
                  studentName: '',
                  type: 'SICK_BAY',
                  complaint: '',
                  treatment: '',
                  temperature: '',
                  referredOut: false,
                  notifyParent: true,
                  notes: '',
                });
                setModal('visit');
              }}
            >
              <Plus size={16} /> Log visit
            </Button>
          )
        }
      />
      {s && (
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <KeyStat label="Visits (30 days)" value={s.visits30d} />
          <KeyStat label="Today" value={s.today.length} tone="brand" />
          <KeyStat label="Referred to hospital (30d)" value={s.referred30d} tone={s.referred30d ? 'red' : 'emerald'} />
          <KeyStat label="Students with allergies on file" value={s.studentsWithAllergies} tone="amber" />
        </div>
      )}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'visits', label: 'Visits' },
          { id: 'records', label: 'Health records' },
        ]}
      />
      {tab === 'visits' && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <SearchBox
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder="Student or complaint"
              />
            </div>
            <Select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              placeholder="All types"
              options={['SICK_BAY', 'INJURY', 'CHECKUP', 'MEDICATION', 'EMERGENCY', 'OTHER'].map((t) => ({
                value: t,
                label: title(t),
              }))}
            />
          </div>
          <DataTable
            rows={visits.data?.items}
            loading={visits.loading}
            page={page}
            pageSize={25}
            total={visits.data?.total}
            onPage={setPage}
            emptyTitle="No visits recorded"
            columns={[
              { key: 'date', header: 'When', render: (v: any) => fmtDateTime(v.date) },
              {
                key: 'student',
                header: 'Student',
                render: (v: any) => (
                  <button
                    className="text-left hover:underline"
                    onClick={() => {
                      setRecordStudent(v.student.id);
                      setTab('records');
                    }}
                  >
                    <span className="font-medium">
                      {v.student.firstName} {v.student.lastName}
                    </span>
                    <span className="block text-xs text-slate-500">{v.student.class?.name}</span>
                  </button>
                ),
              },
              {
                key: 'type',
                header: 'Type',
                render: (v: any) => (
                  <Badge tone={v.type === 'EMERGENCY' ? 'red' : v.type === 'INJURY' ? 'amber' : 'sky'}>{v.type}</Badge>
                ),
              },
              { key: 'complaint', header: 'Complaint', render: (v: any) => v.complaint },
              { key: 'treatment', header: 'Treatment', render: (v: any) => v.treatment ?? '—' },
              {
                key: 'temperature',
                header: '°C',
                align: 'right',
                render: (v: any) => (v.temperature ? Number(v.temperature).toFixed(1) : '—'),
              },
              {
                key: 'flags',
                header: '',
                render: (v: any) => (
                  <span className="space-x-1">
                    {v.referredOut && <Badge tone="red">Referred</Badge>}
                    {v.parentNotified && <Badge tone="emerald">Parent notified</Badge>}
                  </span>
                ),
              },
            ]}
          />
        </>
      )}
      {tab === 'records' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Find a student">
            <SearchBox value={studentSearch} onChange={setStudentSearch} placeholder="Name or ID…" />
            {students?.items?.length > 0 && (
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {students.items.map((st: any) => (
                  <li key={st.id}>
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => {
                        setRecordStudent(st.id);
                        setStudentSearch('');
                      }}
                    >
                      {st.firstName} {st.lastName} <span className="text-slate-500">· {st.class?.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Alert kind="info" className="mt-3">
              Health data is visible only to staff with clinic permissions. Parents see allergies, conditions and visits
              for their own children.
            </Alert>
          </Card>
          <div className="lg:col-span-2">
            {record.data ? (
              <div className="space-y-4">
                <Card
                  title={
                    <span className="flex items-center gap-2">
                      <HeartPulse size={16} /> {record.data.student.firstName} {record.data.student.lastName}
                    </span>
                  }
                  actions={
                    <Link
                      href={`/school/students/${record.data.student.id}`}
                      className="text-xs text-brand hover:underline"
                    >
                      Profile
                    </Link>
                  }
                >
                  <p className="mb-3 text-xs text-slate-500">
                    {record.data.student.class?.name} · {title(record.data.student.gender)} · born{' '}
                    {fmtDate(record.data.student.dateOfBirth)} · emergency:{' '}
                    {record.data.student.emergencyContactName ?? '—'} {record.data.student.emergencyContactPhone ?? ''}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Blood group">
                      <Select
                        value={rf.bloodGroup ?? ''}
                        onChange={(e) => setRf({ ...rf, bloodGroup: e.target.value })}
                        placeholder="Unknown"
                        options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => ({
                          value: b,
                          label: b,
                        }))}
                      />
                    </Field>
                    <Field label="Insurance (provider / number)">
                      <div className="flex gap-2">
                        <Input
                          value={rf.insuranceProvider ?? ''}
                          onChange={(e) => setRf({ ...rf, insuranceProvider: e.target.value })}
                          placeholder="NHIS"
                        />
                        <Input
                          value={rf.insuranceNumber ?? ''}
                          onChange={(e) => setRf({ ...rf, insuranceNumber: e.target.value })}
                          placeholder="Number"
                        />
                      </div>
                    </Field>
                    <Field label="Allergies">
                      <Textarea
                        value={rf.allergies ?? ''}
                        onChange={(e) => setRf({ ...rf, allergies: e.target.value })}
                      />
                    </Field>
                    <Field label="Medical conditions">
                      <Textarea
                        value={rf.conditions ?? ''}
                        onChange={(e) => setRf({ ...rf, conditions: e.target.value })}
                      />
                    </Field>
                    <Field label="Regular medications">
                      <Textarea
                        value={rf.medications ?? ''}
                        onChange={(e) => setRf({ ...rf, medications: e.target.value })}
                      />
                    </Field>
                    <Field label="Immunizations (one per line, e.g. Measles (2016-01-15))">
                      <Textarea
                        value={rf.immunizations ?? ''}
                        onChange={(e) => setRf({ ...rf, immunizations: e.target.value })}
                      />
                    </Field>
                    <Field label="Family doctor">
                      <div className="flex gap-2">
                        <Input
                          value={rf.doctorName ?? ''}
                          onChange={(e) => setRf({ ...rf, doctorName: e.target.value })}
                          placeholder="Name"
                        />
                        <Input
                          value={rf.doctorPhone ?? ''}
                          onChange={(e) => setRf({ ...rf, doctorPhone: e.target.value })}
                          placeholder="Phone"
                        />
                      </div>
                    </Field>
                    <Field label="Notes">
                      <Textarea value={rf.notes ?? ''} onChange={(e) => setRf({ ...rf, notes: e.target.value })} />
                    </Field>
                  </div>
                  {can('HEALTH_MANAGE') && (
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setF({
                            studentId: record.data.student.id,
                            studentName: `${record.data.student.firstName} ${record.data.student.lastName}`,
                            type: 'SICK_BAY',
                            complaint: '',
                            treatment: '',
                            temperature: '',
                            referredOut: false,
                            notifyParent: true,
                            notes: '',
                          });
                          setModal('visit');
                        }}
                      >
                        Log visit
                      </Button>
                      <Button onClick={saveRecord} loading={busy}>
                        Save record
                      </Button>
                    </div>
                  )}
                </Card>
                <Card title="Visit history" padded={false}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Type</th>
                        <th>Complaint</th>
                        <th>Treatment</th>
                        <th>°C</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.data.visits.map((v: any) => (
                        <tr key={v.id}>
                          <td>{fmtDateTime(v.date)}</td>
                          <td>
                            <Badge>{v.type}</Badge>
                          </td>
                          <td>{v.complaint}</td>
                          <td>{v.treatment ?? '—'}</td>
                          <td>{v.temperature ? Number(v.temperature).toFixed(1) : '—'}</td>
                        </tr>
                      ))}
                      {!record.data.visits.length && (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-slate-500">
                            No visits
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Card>
              </div>
            ) : (
              <Card>
                <p className="py-8 text-center text-sm text-slate-500">
                  Search for a student to open their health record.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
      <Modal
        open={modal === 'visit'}
        onClose={() => setModal(null)}
        title="Log a clinic visit"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={logVisit} loading={busy} disabled={!f.studentId || !f.complaint}>
              Save
            </Button>
          </>
        }
      >
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
                            setStudentSearch('');
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
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type">
              <Select
                value={f.type}
                onChange={(e) => setF({ ...f, type: e.target.value })}
                options={['SICK_BAY', 'INJURY', 'CHECKUP', 'MEDICATION', 'EMERGENCY', 'OTHER'].map((t) => ({
                  value: t,
                  label: title(t),
                }))}
              />
            </Field>
            <Field label="Temperature (°C)">
              <Input
                type="number"
                step="0.1"
                value={f.temperature}
                onChange={(e) => setF({ ...f, temperature: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Complaint">
            <Input value={f.complaint} onChange={(e) => setF({ ...f, complaint: e.target.value })} />
          </Field>
          <Field label="Treatment given">
            <Textarea value={f.treatment} onChange={(e) => setF({ ...f, treatment: e.target.value })} />
          </Field>
          <Field label="Notes">
            <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-4">
            <Checkbox
              label="Referred to hospital"
              checked={!!f.referredOut}
              onChange={(e) => setF({ ...f, referredOut: e.target.checked })}
            />
            <Checkbox
              label="Notify parent"
              checked={!!f.notifyParent}
              onChange={(e) => setF({ ...f, notifyParent: e.target.checked })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
