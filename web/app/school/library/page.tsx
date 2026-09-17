'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BookMarked, Plus } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate, money, title } from '@/lib/format';
import {
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
  useToast,
} from '@/components/ui';

/** Library: catalogue, loans, returns and fines. */
export default function LibraryPage() {
  const toast = useToast();
  const { can, me } = useAuth();
  const cur = me?.tenant?.currency ?? 'GHS';
  const [tab, setTab] = useState('books');
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const books = useApi(tab === 'books' ? `/library/books${qs({ search: q, category, page, pageSize: 25 })}` : null, [
    tab,
    q,
    category,
    page,
  ]);
  const [loanStatus, setLoanStatus] = useState('');
  const loans = useApi(
    tab === 'loans' ? `/library/loans${qs({ search: q, status: loanStatus, page, pageSize: 25 })}` : null,
    [tab, q, loanStatus, page],
  );
  const summary = useApi('/library/summary');
  const [modal, setModal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({});
  const [borrowerSearch, setBorrowerSearch] = useState('');
  const bq = useDebounce(borrowerSearch);
  const { data: students } = useApi(bq.length >= 2 ? `/students${qs({ search: bq, pageSize: 6 })}` : null, [bq]);
  const reloadAll = () => {
    books.reload();
    loans.reload();
    summary.reload();
  };
  const saveBook = async () => {
    setBusy(true);
    try {
      const body = {
        ...f,
        year: f.year ? Number(f.year) : undefined,
        copiesTotal: f.copiesTotal ? Number(f.copiesTotal) : undefined,
      };
      Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
      if (f.id) await api.patch(`/library/books/${f.id}`, body);
      else await api.post('/library/books', body);
      toast.success('Saved');
      setModal(null);
      reloadAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const borrow = async () => {
    setBusy(true);
    try {
      await api.post('/library/loans', {
        bookId: f.bookId,
        studentId: f.studentId || undefined,
        staffId: f.staffId || undefined,
        dueAt: f.dueAt ? new Date(f.dueAt).toISOString() : undefined,
      });
      toast.success('Book issued');
      setModal(null);
      reloadAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const doReturn = async (loan: any, lost = false) => {
    try {
      const r = await api.post(`/library/loans/${loan.id}/return`, { lost, finePaid: false });
      toast.success(lost ? 'Marked lost' : Number(r.fine) > 0 ? `Returned — fine ${money(r.fine, cur)}` : 'Returned');
      reloadAll();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const s = summary.data;
  return (
    <div>
      <PageHeader
        title="Library"
        subtitle="Catalogue, loans, returns and fines"
        actions={
          can('LIBRARY_MANAGE') && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setF({ bookId: '', studentId: '', studentName: '', dueAt: '' });
                  setModal('borrow');
                }}
              >
                <BookMarked size={16} /> Issue a book
              </Button>
              <Button
                onClick={() => {
                  setF({
                    title: '',
                    author: '',
                    isbn: '',
                    category: 'GENERAL',
                    publisher: '',
                    year: '',
                    copiesTotal: 1,
                    location: '',
                  });
                  setModal('book');
                }}
              >
                <Plus size={16} /> Add book
              </Button>
            </>
          )
        }
      />
      {s && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KeyStat label="Titles" value={s.titles} />
          <KeyStat label="Copies" value={s.copies} sub={`${s.available} available`} />
          <KeyStat label="On loan" value={s.onLoan} tone="brand" />
          <KeyStat label="Overdue" value={s.overdueCount} tone={s.overdueCount ? 'red' : 'emerald'} />
          <KeyStat label="Fines outstanding" value={money(s.finesOutstanding, cur)} tone="amber" />
          <KeyStat
            label="Most borrowed"
            value={s.popular[0]?.title ?? '—'}
            sub={s.popular[0] ? `${s.popular[0].loans} loans` : undefined}
          />
        </div>
      )}
      <Tabs
        value={tab}
        onChange={(t) => {
          setTab(t);
          setPage(1);
        }}
        tabs={[
          { id: 'books', label: 'Catalogue' },
          { id: 'loans', label: 'Loans', count: s?.onLoan },
          { id: 'overdue', label: 'Overdue', count: s?.overdueCount },
        ]}
      />
      {tab !== 'overdue' && (
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <SearchBox
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder={tab === 'books' ? 'Title, author or ISBN' : 'Book or borrower'}
            />
          </div>
          {tab === 'books' ? (
            <Select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              placeholder="All categories"
              options={(books.data?.categories ?? []).map((c: any) => ({
                value: c.category,
                label: `${title(c.category)} (${c.count})`,
              }))}
            />
          ) : (
            <Select
              value={loanStatus}
              onChange={(e) => {
                setLoanStatus(e.target.value);
                setPage(1);
              }}
              placeholder="All"
              options={['BORROWED', 'OVERDUE', 'RETURNED', 'LOST'].map((x) => ({ value: x, label: title(x) }))}
            />
          )}
        </div>
      )}
      {tab === 'books' && (
        <DataTable
          rows={books.data?.items}
          loading={books.loading}
          page={page}
          pageSize={25}
          total={books.data?.total}
          onPage={setPage}
          columns={[
            {
              key: 'title',
              header: 'Book',
              render: (b: any) => (
                <div>
                  <p className="font-medium">{b.title}</p>
                  <p className="text-xs text-slate-500">
                    {b.author}
                    {b.publisher ? ` · ${b.publisher}` : ''}
                    {b.year ? ` (${b.year})` : ''}
                  </p>
                </div>
              ),
            },
            { key: 'isbn', header: 'ISBN', render: (b: any) => b.isbn ?? '—' },
            { key: 'category', header: 'Category', render: (b: any) => title(b.category) },
            { key: 'location', header: 'Shelf', render: (b: any) => b.location ?? '—' },
            {
              key: 'copies',
              header: 'Available',
              align: 'right',
              render: (b: any) => (
                <Badge
                  tone={b.copiesAvailable === 0 ? 'red' : 'emerald'}
                >{`${b.copiesAvailable} / ${b.copiesTotal}`}</Badge>
              ),
            },
            {
              key: 'x',
              header: '',
              render: (b: any) =>
                can('LIBRARY_MANAGE') && (
                  <div className="flex gap-2 text-xs">
                    <button
                      className="text-brand hover:underline"
                      disabled={!b.copiesAvailable}
                      onClick={() => {
                        setF({ bookId: b.id, bookTitle: b.title, studentId: '', studentName: '', dueAt: '' });
                        setModal('borrow');
                      }}
                    >
                      Issue
                    </button>
                    <button
                      className="text-brand hover:underline"
                      onClick={() => {
                        setF({
                          ...b,
                          year: b.year ?? '',
                          publisher: b.publisher ?? '',
                          isbn: b.isbn ?? '',
                          location: b.location ?? '',
                        });
                        setModal('book');
                      }}
                    >
                      Edit
                    </button>
                  </div>
                ),
            },
          ]}
        />
      )}
      {(tab === 'loans' || tab === 'overdue') && (
        <DataTable
          rows={tab === 'overdue' ? s?.overdue : loans.data?.items}
          loading={loans.loading}
          page={tab === 'loans' ? page : undefined}
          pageSize={25}
          total={tab === 'loans' ? loans.data?.total : undefined}
          onPage={setPage}
          emptyTitle={tab === 'overdue' ? 'No overdue books' : 'No loans'}
          columns={[
            { key: 'book', header: 'Book', render: (l: any) => <span className="font-medium">{l.book.title}</span> },
            {
              key: 'borrower',
              header: 'Borrower',
              render: (l: any) =>
                l.student ? (
                  <Link href={`/school/students/${l.student.id}`} className="hover:underline">
                    {l.student.firstName} {l.student.lastName}{' '}
                    <span className="text-xs text-slate-500">({l.student.class?.name})</span>
                  </Link>
                ) : l.staff ? (
                  `${l.staff.firstName} ${l.staff.lastName} (staff)`
                ) : (
                  '—'
                ),
            },
            { key: 'borrowedAt', header: 'Borrowed', render: (l: any) => fmtDate(l.borrowedAt) },
            {
              key: 'dueAt',
              header: 'Due',
              render: (l: any) => (
                <span className={l.daysOverdue > 0 ? 'text-red-700' : ''}>
                  {fmtDate(l.dueAt)}
                  {l.daysOverdue > 0 ? ` (${l.daysOverdue}d late)` : ''}
                </span>
              ),
            },
            { key: 'status', header: 'Status', render: (l: any) => <Badge>{l.status}</Badge> },
            {
              key: 'fine',
              header: 'Fine',
              align: 'right',
              render: (l: any) =>
                Number(l.fine) ? (
                  <span className={l.finePaid ? 'text-slate-500 line-through' : 'text-amber-700'}>
                    {money(l.fine, cur)}
                  </span>
                ) : (
                  '—'
                ),
            },
            {
              key: 'x',
              header: '',
              render: (l: any) =>
                can('LIBRARY_MANAGE') && (
                  <div className="flex gap-2 text-xs">
                    {(l.status === 'BORROWED' || l.status === 'OVERDUE') && (
                      <>
                        <button className="text-brand hover:underline" onClick={() => doReturn(l)}>
                          Return
                        </button>
                        <button
                          className="text-red-600 hover:underline"
                          onClick={() => confirm('Mark this copy as lost?') && doReturn(l, true)}
                        >
                          Lost
                        </button>
                      </>
                    )}
                    {Number(l.fine) > 0 && !l.finePaid && (
                      <button
                        className="text-emerald-700 hover:underline"
                        onClick={async () => {
                          await api.post(`/library/loans/${l.id}/fine-paid`);
                          reloadAll();
                        }}
                      >
                        Fine paid
                      </button>
                    )}
                  </div>
                ),
            },
          ]}
        />
      )}
      <Modal
        open={modal === 'book'}
        onClose={() => setModal(null)}
        title={f.id ? 'Edit book' : 'Add book'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={saveBook} loading={busy} disabled={!f.title || !f.author}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['title', 'Title'],
            ['author', 'Author'],
            ['isbn', 'ISBN'],
            ['category', 'Category'],
            ['publisher', 'Publisher'],
            ['year', 'Year'],
            ['copiesTotal', 'Copies'],
            ['location', 'Shelf / location'],
          ].map(([k, l]) => (
            <Field key={k} label={l}>
              <Input value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </Field>
          ))}
        </div>
      </Modal>
      <Modal
        open={modal === 'borrow'}
        onClose={() => setModal(null)}
        title="Issue a book"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={borrow} loading={busy} disabled={!f.bookId || !f.studentId}>
              Issue
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {!f.bookId ? (
            <Field label="Book">
              <Select
                value={f.bookId}
                onChange={(e) => setF({ ...f, bookId: e.target.value })}
                placeholder="Select an available book"
                options={(books.data?.items ?? [])
                  .filter((b: any) => b.copiesAvailable > 0)
                  .map((b: any) => ({ value: b.id, label: `${b.title} — ${b.author}` }))}
              />
            </Field>
          ) : (
            <p className="text-sm">
              Book: <b>{f.bookTitle}</b>
            </p>
          )}
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
                <SearchBox value={borrowerSearch} onChange={setBorrowerSearch} placeholder="Type a name or ID…" />
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
                            setBorrowerSearch('');
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
          <Field label="Due date" hint="Defaults to 14 days">
            <Input type="date" value={f.dueAt ?? ''} onChange={(e) => setF({ ...f, dueAt: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
