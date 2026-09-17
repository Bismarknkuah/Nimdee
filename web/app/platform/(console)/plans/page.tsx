'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { money, title } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
  Textarea,
  useToast,
} from '@/components/ui';

const ALL = [
  'ACADEMICS',
  'ATTENDANCE',
  'OFFLINE_SYNC',
  'FEES',
  'RESULTS',
  'TIMETABLE',
  'CANTEEN',
  'PARENT_PORTAL',
  'WEBSITE',
  'CUSTOM_DOMAIN',
  'COMMUNICATIONS',
  'INVENTORY',
  'ANALYTICS',
  'API',
];

export default function PlansPage() {
  const toast = useToast();
  const { data, loading, reload } = useApi<any[]>('/platform/plans');
  const [modal, setModal] = useState<any>(null);
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const body = {
        ...f,
        priceMonthly: Number(f.priceMonthly),
        priceYearly: Number(f.priceYearly),
        studentLimit: Number(f.studentLimit),
        trialDays: Number(f.trialDays),
        sortOrder: Number(f.sortOrder),
      };
      if (modal.id) await api.patch(`/platform/plans/${modal.id}`, body);
      else await api.post('/platform/plans', body);
      toast.success('Plan saved');
      setModal(null);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <Spinner />;
  return (
    <div>
      <PageHeader
        title="Subscription plans"
        actions={
          <Button
            onClick={() => {
              setF({
                code: '',
                name: '',
                description: '',
                priceMonthly: 0,
                priceYearly: 0,
                currency: 'GHS',
                studentLimit: 500,
                features: ['ACADEMICS', 'ATTENDANCE'],
                trialDays: 14,
                isActive: true,
                sortOrder: 9,
              });
              setModal({});
            }}
          >
            <Plus size={16} /> New plan
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        {(data ?? []).map((p) => (
          <Card
            key={p.id}
            title={
              <span>
                {p.name} {!p.isActive && <Badge tone="slate">INACTIVE</Badge>}
              </span>
            }
            actions={
              <button
                className="text-xs text-brand hover:underline"
                onClick={() => {
                  setF({ ...p, priceMonthly: Number(p.priceMonthly), priceYearly: Number(p.priceYearly) });
                  setModal(p);
                }}
              >
                Edit
              </button>
            }
          >
            <p className="text-xs text-slate-500">
              {p.code} · {p.description}
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {money(p.priceYearly, p.currency)}
              <span className="text-sm font-normal text-slate-500">/yr</span>
            </p>
            <p className="text-sm text-slate-500">
              {money(p.priceMonthly, p.currency)}/mo · {p.studentLimit.toLocaleString()} students · {p.trialDays}-day
              trial · {p._count.subscriptions} school(s)
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-x-2 text-xs text-slate-600">
              {p.features.map((x: string) => (
                <li key={x}>✓ {title(x)}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? `Edit ${modal.name}` : 'New plan'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['code', 'Code'],
            ['name', 'Name'],
            ['currency', 'Currency'],
            ['priceMonthly', 'Monthly price'],
            ['priceYearly', 'Yearly price'],
            ['studentLimit', 'Student limit'],
            ['trialDays', 'Trial days'],
            ['sortOrder', 'Sort order'],
          ].map(([k, l]) => (
            <Field key={k} label={l}>
              <Input value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </Field>
          ))}
          <div className="flex items-end pb-2">
            <Checkbox
              label="Active"
              checked={!!f.isActive}
              onChange={(e) => setF({ ...f, isActive: e.target.checked })}
            />
          </div>
        </div>
        <Field label="Description" className="mt-3">
          <Textarea value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <p className="label mt-3">Features</p>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {ALL.map((x) => (
            <Checkbox
              key={x}
              label={title(x)}
              checked={(f.features ?? []).includes(x)}
              onChange={(e) =>
                setF({
                  ...f,
                  features: e.target.checked ? [...(f.features ?? []), x] : f.features.filter((y: string) => y !== x),
                })
              }
            />
          ))}
        </div>
      </Modal>
    </div>
  );
}
