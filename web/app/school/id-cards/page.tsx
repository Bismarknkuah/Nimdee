'use client';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Suspense, useEffect, useState } from 'react';
import { Printer, ScanLine } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useAcademic, classOptions } from '@/lib/academic';
import { useApi } from '@/lib/hooks';
import { fmtDate } from '@/lib/format';
import { Button, Card, Field, Input, PageHeader, Select, Spinner, useToast } from '@/components/ui';

function IdCard({ card }: { card: any }) {
  const { student: s, school, academicYear, qrPayload } = card;
  return (
    <div
      className="flex w-[340px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card print:shadow-none"
      style={{ breakInside: 'avoid' }}
    >
      <div className="flex items-center gap-2 px-4 py-2 text-white" style={{ background: school.primaryColor }}>
        {school.logoUrl && <img src={school.logoUrl} alt="" className="h-8 w-8 rounded bg-white object-cover" />}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight">{school.name}</p>
          <p className="text-[10px] opacity-80">Student identity card · {academicYear}</p>
        </div>
      </div>
      <div className="flex gap-3 p-3">
        {s.photoUrl ? (
          <img src={s.photoUrl} alt="" className="h-24 w-20 rounded-md object-cover" />
        ) : (
          <div className="flex h-24 w-20 items-center justify-center rounded-md bg-slate-100 text-2xl font-bold text-slate-400">
            {s.name[0]}
          </div>
        )}
        <div className="min-w-0 flex-1 text-xs">
          <p className="truncate text-base font-bold text-slate-900">{s.name}</p>
          <p>
            <span className="text-slate-500">ID:</span> <b>{s.studentId}</b>
          </p>
          <p>
            <span className="text-slate-500">Class:</span> {s.className}
          </p>
          <p>
            <span className="text-slate-500">DOB:</span> {fmtDate(s.dateOfBirth)}
          </p>
          {s.house && (
            <p>
              <span className="text-slate-500">House:</span> {s.house}
            </p>
          )}
          <p>
            <span className="text-slate-500">Emergency:</span> {s.emergencyPhone || '—'}
          </p>
        </div>
        <QRCodeSVG value={qrPayload} size={64} />
      </div>
      <div className="px-3 pb-2 text-[9px] text-slate-500">
        If found, please return to {school.name}. Scan the QR code with the school app to verify.
      </div>
    </div>
  );
}

function IdCards() {
  const params = useSearchParams();
  const toast = useToast();
  const { classes } = useAcademic();
  const [classId, setClassId] = useState('');
  const [cards, setCards] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState('');
  const [verify, setVerify] = useState<any>(null);
  const studentId = params.get('studentId');
  const { data: list } = useApi(classId ? `/students${qs({ classId, pageSize: 100 })}` : null, [classId]);
  useEffect(() => {
    if (studentId)
      api
        .get(`/students/${studentId}/id-card`)
        .then((c) => setCards([c]))
        .catch((e) => toast.error(e.message));
  }, [studentId]); // eslint-disable-line
  const generate = async () => {
    if (!list?.items?.length) return;
    setBusy(true);
    try {
      setCards(await Promise.all(list.items.map((s: any) => api.get(`/students/${s.id}/id-card`))));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const doVerify = async () => {
    try {
      setVerify(await api.post('/students/verify-qr', { payload: scan.trim() }));
    } catch (e: any) {
      setVerify({ error: e.message });
    }
  };
  return (
    <div>
      <PageHeader
        title="Student ID cards"
        subtitle="Signed QR codes let staff verify a card is genuine"
        actions={
          cards.length > 0 && (
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={16} /> Print {cards.length} card(s)
            </Button>
          )
        }
      />
      <div className="no-print mb-4 grid gap-4 lg:grid-cols-2">
        <Card title="Generate by class">
          <div className="flex items-end gap-2">
            <Field label="Class" className="flex-1">
              <Select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                placeholder="Select class"
                options={classOptions(classes)}
              />
            </Field>
            <Button onClick={generate} loading={busy} disabled={!list?.items?.length}>
              Generate {list?.items?.length ? `(${list.items.length})` : ''}
            </Button>
          </div>
        </Card>
        <Card title="Verify a scanned card">
          <div className="flex items-end gap-2">
            <Field label="QR payload" className="flex-1">
              <Input value={scan} onChange={(e) => setScan(e.target.value)} placeholder="SOS1|SCH-…" />
            </Field>
            <Button variant="secondary" onClick={doVerify}>
              <ScanLine size={16} /> Verify
            </Button>
          </div>
          {verify && (
            <p className={`mt-2 text-sm ${verify.error || !verify.valid ? 'text-red-700' : 'text-emerald-700'}`}>
              {verify.error
                ? verify.error
                : verify.valid
                  ? `✔ Genuine: ${verify.student.firstName} ${verify.student.lastName} (${verify.student.class?.name ?? 'no class'})`
                  : `Card belongs to ${verify.student.firstName} ${verify.student.lastName} but the student is ${verify.student.status}`}
            </p>
          )}
        </Card>
      </div>
      {busy && <Spinner />}
      <div className="flex flex-wrap gap-4 print:gap-2">
        {cards.map((c) => (
          <IdCard key={c.student.id} card={c} />
        ))}
      </div>
    </div>
  );
}
export default function IdCardsPage() {
  return (
    <Suspense>
      <IdCards />
    </Suspense>
  );
}
