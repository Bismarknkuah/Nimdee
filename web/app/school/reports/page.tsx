'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { downloadBlob, qs } from '@/lib/api';
import { useAcademic } from '@/lib/academic';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { money, title } from '@/lib/format';
import { BarSeries, Donut, LineSeries } from '@/components/charts';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  KeyStat,
  PageHeader,
  ProgressBar,
  Select,
  Spinner,
  Tabs,
} from '@/components/ui';

/** Reports & analytics: enrolment, attendance, finance ageing, academic performance, staff workload. */
export default function ReportsPage() {
  const { me, can, has } = useAuth();
  const cur = me?.tenant?.currency ?? 'GHS';
  const { term, terms } = useAcademic();
  const [tab, setTab] = useState('enrolment');
  const [termId, setTermId] = useState('');
  const [from, setFrom] = useState(new Date(Date.now() - 56 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  useEffect(() => {
    if (term && !termId) setTermId(term.id);
  }, [term, termId]);
  const enrolment = useApi(tab === 'enrolment' ? '/reports/enrolment' : null, [tab]);
  const attendance = useApi(tab === 'attendance' ? `/reports/attendance${qs({ from, to })}` : null, [tab, from, to]);
  const finance = useApi(tab === 'finance' ? '/reports/finance' : null, [tab]);
  const academic = useApi(tab === 'academic' && termId ? `/reports/academic${qs({ termId })}` : null, [tab, termId]);
  const staff = useApi(tab === 'staff' ? '/reports/staff' : null, [tab]);
  const birthdays = useApi(tab === 'enrolment' ? '/analytics/birthdays?days=14' : null, [tab]);
  return (
    <div>
      <PageHeader
        title="Reports & analytics"
        subtitle="Live insight across enrolment, attendance, finance, academics and staff"
        actions={
          can('EXPORT_DATA') && (
            <Button variant="secondary" onClick={() => downloadBlob('/exports/students.csv', 'students.csv')}>
              <Download size={16} /> Export students
            </Button>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'enrolment', label: 'Enrolment' },
          ...(has('ATTENDANCE') ? [{ id: 'attendance', label: 'Attendance' }] : []),
          ...(has('FEES') ? [{ id: 'finance', label: 'Finance' }] : []),
          ...(has('RESULTS') ? [{ id: 'academic', label: 'Academic performance' }] : []),
          { id: 'staff', label: 'Staff' },
        ]}
      />

      {tab === 'enrolment' &&
        (enrolment.data ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <KeyStat label="Active students" value={enrolment.data.byStatus.ACTIVE ?? 0} />
              <KeyStat
                label="Boys / girls"
                value={`${enrolment.data.byGender.MALE ?? 0} / ${enrolment.data.byGender.FEMALE ?? 0}`}
              />
              <KeyStat
                label="Boarding / day"
                value={`${enrolment.data.boarding.boarding} / ${enrolment.data.boarding.day}`}
              />
              <KeyStat
                label="Admitted (12 months)"
                value={enrolment.data.admissionsByMonth.reduce((a: number, m: any) => a + m.count, 0)}
                tone="emerald"
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Students per class">
                <BarSeries
                  data={enrolment.data.byClass.map((c: any) => ({
                    name: c.name,
                    students: c.students,
                    capacity: c.capacity ?? 0,
                  }))}
                  x="name"
                  bars={[{ key: 'students' }, { key: 'capacity', color: '#cbd5e1' }]}
                />
              </Card>
              <Card title="Admissions by month">
                <BarSeries
                  data={enrolment.data.admissionsByMonth}
                  x="month"
                  bars={[{ key: 'count', name: 'New students' }]}
                />
              </Card>
              <Card title="Class capacity" padded={false}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Level</th>
                      <th className="w-48">Fill</th>
                      <th className="text-right">Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrolment.data.byClass.map((c: any) => (
                      <tr key={c.classId}>
                        <td>
                          <Link href={`/school/classes/${c.classId}`} className="hover:underline">
                            {c.name}
                          </Link>
                        </td>
                        <td>{c.level}</td>
                        <td>
                          {c.fill !== null ? (
                            <ProgressBar value={c.fill} tone={c.fill > 95 ? 'red' : 'brand'} />
                          ) : (
                            <span className="text-xs text-slate-400">no capacity set</span>
                          )}
                        </td>
                        <td className="text-right">
                          {c.students}
                          {c.capacity ? ` / ${c.capacity}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <Card title="Birthdays in the next 14 days" padded={false}>
                {Array.isArray(birthdays.data) && birthdays.data.length ? (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Class</th>
                        <th>Birthday</th>
                      </tr>
                    </thead>
                    <tbody>
                      {birthdays.data.slice(0, 12).map((b: any, i: number) => (
                        <tr key={i}>
                          <td>
                            {b.firstName ?? b.name} {b.lastName ?? ''}
                          </td>
                          <td>{b.className ?? b.class?.name ?? '—'}</td>
                          <td>{b.birthday ?? b.date ?? b.dateOfBirth?.slice(5)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="p-4 text-sm text-slate-500">No birthdays coming up.</p>
                )}
              </Card>
            </div>
          </div>
        ) : (
          <Spinner />
        ))}

      {tab === 'attendance' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="From">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          {attendance.data ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <KeyStat
                  label="School attendance rate"
                  value={attendance.data.schoolRate !== null ? `${attendance.data.schoolRate}%` : '—'}
                  tone={attendance.data.schoolRate >= 90 ? 'emerald' : 'amber'}
                />
                <KeyStat label="Days recorded" value={attendance.data.daily.length} />
                <KeyStat
                  label="Chronic absentees (<80%)"
                  value={attendance.data.chronicAbsentees.length}
                  tone={attendance.data.chronicAbsentees.length ? 'red' : 'emerald'}
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Daily attendance rate">
                  <LineSeries data={attendance.data.daily} x="date" lines={[{ key: 'rate', name: 'Rate %' }]} />
                </Card>
                <Card title="Weekly rate by class" padded={false} className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Class</th>
                        {attendance.data.weeks.map((w: string) => (
                          <th key={w} className="text-right">
                            {w.slice(5)}
                          </th>
                        ))}
                        <th className="text-right">Overall</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.data.byClass.map((c: any) => (
                        <tr key={c.classId}>
                          <td>{c.name}</td>
                          {c.weeks.map((w: any) => (
                            <td
                              key={w.week}
                              className={`text-right ${w.rate !== null && w.rate < 80 ? 'text-red-700' : ''}`}
                            >
                              {w.rate === null ? '—' : `${w.rate}%`}
                            </td>
                          ))}
                          <td className="text-right font-semibold">{c.overall === null ? '—' : `${c.overall}%`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
              <Card title="Students needing follow-up (attendance below 80%)" padded={false}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Class</th>
                      <th className="text-right">Days recorded</th>
                      <th className="text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.data.chronicAbsentees.map((s: any) => (
                      <tr key={s.studentId}>
                        <td>
                          <Link href={`/school/students/${s.studentId}`} className="hover:underline">
                            {s.firstName} {s.lastName}
                          </Link>{' '}
                          <span className="text-xs text-slate-500">{s.studentId}</span>
                        </td>
                        <td>{s.class?.name}</td>
                        <td className="text-right">{s.days}</td>
                        <td className="text-right font-semibold text-red-700">{s.rate}%</td>
                      </tr>
                    ))}
                    {!attendance.data.chronicAbsentees.length && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-500">
                          No chronic absentees in this period 🎉
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
            </>
          ) : (
            <Spinner />
          )}
        </div>
      )}

      {tab === 'finance' &&
        (finance.data ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-5">
              <KeyStat label="Total outstanding" value={money(finance.data.totalOutstanding, cur)} tone="red" />
              {['current', '1-30', '31-60', '61-90', '90+'].map((k) => (
                <KeyStat
                  key={k}
                  label={k === 'current' ? 'Not yet due' : `${k} days overdue`}
                  value={money(finance.data.ageing[k], cur)}
                  tone={k === 'current' ? 'brand' : k === '90+' ? 'red' : 'amber'}
                />
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Collections by month (12 months)">
                <BarSeries
                  data={finance.data.collectionsByMonth}
                  x="month"
                  bars={[
                    { key: 'fees', name: 'School fees' },
                    { key: 'wallet', name: 'Canteen top-ups', color: '#8b5cf6' },
                  ]}
                  stacked
                />
              </Card>
              <Card title="Billed by fee category">
                <BarSeries
                  data={finance.data.byCategory}
                  x="category"
                  bars={[
                    { key: 'billed', name: 'Billed' },
                    { key: 'discounts', name: 'Discounts', color: '#10b981' },
                  ]}
                />
              </Card>
              <Card title="Payment methods">
                <Donut data={finance.data.byMethod.map((m: any) => ({ name: title(m.method), value: m.amount }))} />
              </Card>
              <Card title="Top defaulters" padded={false}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Class</th>
                      <th className="text-right">Invoices</th>
                      <th className="text-right">Oldest (days)</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finance.data.topDefaulters.map((d: any) => (
                      <tr key={d.id}>
                        <td>
                          <Link href={`/school/students/${d.id}`} className="hover:underline">
                            {d.firstName} {d.lastName}
                          </Link>
                        </td>
                        <td>{d.class?.name}</td>
                        <td className="text-right">{d.invoices}</td>
                        <td className="text-right">{d.oldestDays > 0 ? d.oldestDays : '—'}</td>
                        <td className="text-right font-semibold text-red-700">{money(d.balance, cur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          </div>
        ) : (
          <Spinner />
        ))}

      {tab === 'academic' && (
        <div className="space-y-4">
          <div className="max-w-xs">
            <Field label="Term">
              <Select
                value={termId}
                onChange={(e) => setTermId(e.target.value)}
                options={terms.map((t: any) => ({ value: t.id, label: t.name }))}
              />
            </Field>
          </div>
          {academic.data ? (
            academic.data.sheets ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Average by class">
                  <BarSeries
                    data={academic.data.byClass}
                    x="name"
                    bars={[
                      { key: 'average', name: 'Average %' },
                      { key: 'passRate', name: 'Pass rate %', color: '#10b981' },
                    ]}
                  />
                </Card>
                <Card title="Grade distribution">
                  <Donut
                    data={Object.entries(academic.data.gradeDistribution).map(([g, n]) => ({
                      name: g,
                      value: n as number,
                    }))}
                  />
                </Card>
                <Card title="Subject performance" padded={false}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th className="text-right">Average</th>
                        <th className="text-right">Top score</th>
                        <th className="text-right">Students</th>
                      </tr>
                    </thead>
                    <tbody>
                      {academic.data.bySubject.map((s: any) => (
                        <tr key={s.code}>
                          <td>{s.subject}</td>
                          <td className="text-right font-medium">{s.average}%</td>
                          <td className="text-right">{s.top}%</td>
                          <td className="text-right">{s.students}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
                <Card title="Class summary" padded={false}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Class</th>
                        <th className="text-right">Sheets</th>
                        <th className="text-right">Average</th>
                        <th className="text-right">Pass rate</th>
                        <th>Published</th>
                      </tr>
                    </thead>
                    <tbody>
                      {academic.data.byClass.map((c: any) => (
                        <tr key={c.classId}>
                          <td>{c.name}</td>
                          <td className="text-right">{c.students}</td>
                          <td className="text-right">{c.average}%</td>
                          <td className="text-right">{c.passRate}%</td>
                          <td>
                            {c.published === c.students ? (
                              <Badge tone="emerald">All</Badge>
                            ) : (
                              <Badge tone="amber">{`${c.published}/${c.students}`}</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            ) : (
              <Card>
                <p className="py-8 text-center text-sm text-slate-500">No results computed for this term yet.</p>
              </Card>
            )
          ) : (
            <Spinner />
          )}
        </div>
      )}

      {tab === 'staff' &&
        (staff.data ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="By department">
              <Donut data={staff.data.byDepartment.map((d: any) => ({ name: d.department, value: d.count }))} />
            </Card>
            <Card title="Teacher workload" className="lg:col-span-2" padded={false}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Teacher</th>
                    <th>Class teacher of</th>
                    <th className="text-right">Subjects</th>
                    <th className="text-right">Classes</th>
                    <th className="text-right">Periods / week</th>
                    <th className="text-right">Leave (12m)</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.data.teachers.map((t: any) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/school/staff/${t.id}`} className="hover:underline">
                          {t.name}
                        </Link>{' '}
                        <span className="text-xs text-slate-500">{t.employeeId}</span>
                      </td>
                      <td>{t.classTeacherOf.join(', ') || '—'}</td>
                      <td className="text-right">{t.subjects}</td>
                      <td className="text-right">{t.classes}</td>
                      <td className="text-right">{t.periodsPerWeek}</td>
                      <td className="text-right">{t.leaveDays12m}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        ) : (
          <Spinner />
        ))}
    </div>
  );
}
