'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Download, UserPlus } from 'lucide-react';
import { qs, downloadBlob } from '@/lib/api';
import { useAcademic, classOptions } from '@/lib/academic';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import { Avatar, Badge, DataTable, PageHeader, SearchBox, Select } from '@/components/ui';

function StudentsList() {
  const { can, me } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const { classes } = useAcademic();
  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState(params.get('classId') ?? '');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounce(search);
  const { data, loading } = useApi(`/students${qs({ search: q, classId, status, page, pageSize: 25 })}`);
  const cur = me?.tenant?.currency;
  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={data ? `${data.total} students` : undefined}
        actions={
          <>
            {can('EXPORT_DATA') && (
              <button
                className="btn-secondary"
                onClick={() => downloadBlob(`/exports/students.csv${qs({ classId })}`, 'students.csv')}
              >
                <Download size={16} /> Export
              </button>
            )}
            {can('STUDENT_CREATE') && (
              <Link href="/school/students/new" className="btn-primary">
                <UserPlus size={16} /> Enrol student
              </Link>
            )}
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search by name or student ID"
          />
        </div>
        <Select
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setPage(1);
          }}
          placeholder="All classes"
          options={classOptions(classes)}
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          placeholder="Active & others"
          options={['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED', 'SUSPENDED'].map((s) => ({
            value: s,
            label: s.charAt(0) + s.slice(1).toLowerCase(),
          }))}
        />
      </div>
      <DataTable
        rows={data?.items}
        loading={loading}
        page={page}
        pageSize={25}
        total={data?.total}
        onPage={setPage}
        onRowClick={(r: any) => router.push(`/school/students/${r.id}`)}
        columns={[
          {
            key: 'name',
            header: 'Student',
            render: (r: any) => (
              <div className="flex items-center gap-2">
                <Avatar name={`${r.firstName} ${r.lastName}`} src={r.photoUrl} size="sm" />
                <div>
                  <p className="font-medium text-slate-900">
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{r.studentId}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'class',
            header: 'Class',
            render: (r: any) => r.class?.name ?? <span className="text-slate-400">Unassigned</span>,
          },
          { key: 'gender', header: 'Gender', render: (r: any) => r.gender.charAt(0) + r.gender.slice(1).toLowerCase() },
          {
            key: 'guardian',
            header: 'Primary guardian',
            render: (r: any) =>
              r.primaryGuardian
                ? `${r.primaryGuardian.firstName} ${r.primaryGuardian.lastName} · ${r.primaryGuardian.phone}`
                : '—',
          },
          {
            key: 'balance',
            header: 'Fees balance',
            align: 'right',
            render: (r: any) => (
              <span className={Number(r.balance) > 0 ? 'text-red-700' : 'text-slate-600'}>{money(r.balance, cur)}</span>
            ),
          },
          { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
export default function StudentsPage() {
  return (
    <Suspense>
      <StudentsList />
    </Suspense>
  );
}
