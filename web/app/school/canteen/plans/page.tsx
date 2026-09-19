'use client';
import { useEffect, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { money, title } from '@/lib/format';
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
  Select,
  Textarea,
  useToast,
} from '@/components/ui';

const TYPE_OPTIONS = [
  { value: 'MEAL_PLAN', label: 'Meal plan (flat rate, covers meals per day)' },
  { value: 'PREPAID', label: 'Prepaid wallet (top up, purchases deduct)' },
  { value: 'PAY_AS_YOU_GO', label: 'Pay as you go (cash at the counter)' },
  { value: 'CREDIT', label: 'Credit (wallet may go negative up to a limit)' },
  { value: 'ALLOWANCE', label: 'Allowance (school credits the wallet automatically)' },
];
const PERIOD_OPTIONS = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'TERM', label: 'Per term' },
  { value: 'NONE', label: 'No fixed period' },
];

function PlanModal({ plan, onClose, onSaved }: { plan: any; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>(
    plan ?? {
      code: '',
      name: '',
      description: '',
      type: 'MEAL_PLAN',
      price: '',
      billingPeriod: 'DAILY',
      mealsPerDay: 1,
      billToFees: true,
    },
  );
  const isMealPlan = f.type === 'MEAL_PLAN';
  const save = async () => {
    setBusy(true);
    try {
      const body = {
        ...f,
        price: f.price === '' ? 0 : Number(f.price),
        mealsPerDay: Number(f.mealsPerDay || 1),
      };
      if (plan?.id) await api.patch(`/canteen/plans/${plan.id}`, body);
      else await api.post('/canteen/plans', body);
      toast.success('Plan saved');
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={plan?.id ? 'Edit plan' : 'New canteen plan'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Code" hint="Short internal code, e.g. KG-MEAL">
          <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        </Field>
        <Field label="Name" hint="Shown to parents and staff">
          <Input
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="KG & Primary meal plan"
          />
        </Field>
        <Field label="Type" className="sm:col-span-2">
          <Select options={TYPE_OPTIONS} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Textarea
            value={f.description ?? ''}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            rows={2}
          />
        </Field>
        {(isMealPlan || f.type === 'ALLOWANCE') && (
          <>
            <Field label="Price per period" hint="e.g. 5 for a daily rate, 25 for a school week">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={f.price}
                onChange={(e) => setF({ ...f, price: e.target.value })}
              />
            </Field>
            <Field label="Billing period">
              <Select
                options={PERIOD_OPTIONS}
                value={f.billingPeriod}
                onChange={(e) => setF({ ...f, billingPeriod: e.target.value })}
              />
            </Field>
          </>
        )}
        {isMealPlan && (
          <Field label="Meals covered per day" hint="How many check-ins a student gets each day">
            <Input
              type="number"
              min="1"
              value={f.mealsPerDay}
              onChange={(e) => setF({ ...f, mealsPerDay: e.target.value })}
            />
          </Field>
        )}
        {f.type === 'CREDIT' && (
          <Field label="Credit limit" hint="How far the wallet may go negative">
            <Input
              type="number"
              min="0"
              value={f.creditLimit ?? ''}
              onChange={(e) => setF({ ...f, creditLimit: e.target.value })}
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function EnrolModal({ plan, onClose, onDone }: { plan: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { data: classes } = useApi<any[]>('/academic/classes');
  const { data: feeding } = useApi<any>('/canteen/plans/feeding-classes');
  const exemptIds: string[] = feeding?.exemptClassIds ?? [];
  const eligibleClasses = (classes ?? []).filter((c: any) => !exemptIds.includes(c.id));
  const [busy, setBusy] = useState(false);
  const [classId, setClassId] = useState('');
  const [bill, setBill] = useState(plan.billToFees ? 'FEES' : 'WALLET');
  const submit = async () => {
    if (!classId) return toast.error('Choose a class');
    setBusy(true);
    try {
      const r = await api.post(`/canteen/plans/${plan.id}/enrol`, { classId, bill: bill === 'FEES' });
      toast.success(`${r.enrolled} student(s) enrolled${r.billed ? `, ${r.billed} charged` : ''}`);
      if (r.errors?.length) toast.error(`${r.errors.length} could not be enrolled`);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Enrol a class into ${plan.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Enrol class
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field
          label="Class"
          hint={
            exemptIds.length
              ? "Every active student in this class joins the plan today. Classes exempt from feeding aren't listed."
              : 'Every active student in this class joins the plan today'
          }
        >
          <Select
            placeholder="Choose a class"
            options={eligibleClasses.map((c: any) => ({ value: c.id, label: `${c.name} (${title(c.level)})` }))}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          />
        </Field>
        {Number(plan.price) > 0 && (
          <Field label="How should this be charged?">
            <Select
              options={[
                { value: 'FEES', label: 'Bill through Fees (an invoice per student)' },
                { value: 'WALLET', label: 'Charge the canteen wallet now (lump sum)' },
              ]}
              value={bill}
              onChange={(e) => setBill(e.target.value)}
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function ExemptClassesCard() {
  const toast = useToast();
  const { can } = useAuth();
  const { data: classes } = useApi<any[]>('/academic/classes');
  const { data: feeding, reload } = useApi<any>('/canteen/plans/feeding-classes');
  const [selected, setSelected] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (feeding) setSelected(feeding.exemptClassIds ?? []);
  }, [feeding]);
  if (!feeding || selected === null) return null;
  const toggle = (id: string) =>
    setSelected((prev) => (prev!.includes(id) ? prev!.filter((x) => x !== id) : [...prev!, id]));
  const save = async () => {
    setBusy(true);
    try {
      await api.patch('/canteen/plans/feeding-classes', { exemptClassIds: selected });
      toast.success('Feeding classes updated');
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card
      title="Which classes are fed"
      actions={
        can('CANTEEN_MANAGE') && (
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        )
      }
    >
      <p className="mb-3 text-sm text-slate-500">
        The school feeds every student on every school day by default. Tick any class or form that
        does not take part (for example JHS at a school that only feeds KG and Primary); they won't
        appear when enrolling a class into a plan.
      </p>
      <div className="grid gap-1 sm:grid-cols-3">
        {(classes ?? []).map((c: any) => (
          <Checkbox
            key={c.id}
            label={`${c.name} (${title(c.level)})`}
            checked={selected.includes(c.id)}
            onChange={() => toggle(c.id)}
          />
        ))}
      </div>
    </Card>
  );
}

export default function CanteenPlansPage() {
  const { me, can } = useAuth();
  const cur = me?.tenant?.currency ?? 'GHS';
  const { data, loading, reload } = useApi<any[]>('/canteen/plans');
  const [editing, setEditing] = useState<any>(null);
  const [enrolling, setEnrolling] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  return (
    <div>
      <PageHeader
        title="Meal plans & payment plans"
        subtitle="Set a rate per class or level, then enrol a class in one step"
        actions={
          can('CANTEEN_MANAGE') && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} /> New plan
            </Button>
          )
        }
      />
      <div className="mb-4">
        <ExemptClassesCard />
      </div>
      <Card padded={false}>
        <DataTable
          columns={[
            { key: 'name', header: 'Plan', render: (p: any) => <span className="font-medium">{p.name}</span> },
            { key: 'type', header: 'Type', render: (p: any) => <Badge>{title(p.type)}</Badge> },
            {
              key: 'price',
              header: 'Price',
              render: (p: any) =>
                Number(p.price) > 0 ? `${money(p.price, cur)} / ${p.billingPeriod.toLowerCase()}` : '\u2014',
            },
            {
              key: 'meals',
              header: 'Meals/day',
              render: (p: any) => (p.type === 'MEAL_PLAN' ? p.mealsPerDay : '\u2014'),
            },
            { key: 'billing', header: 'Billed via', render: (p: any) => (p.billToFees ? 'Fees' : 'Wallet') },
            { key: 'status', header: 'Status', render: (p: any) => <Badge tone={p.isActive ? 'emerald' : 'slate'}>{p.isActive ? 'Active' : 'Inactive'}</Badge> },
            {
              key: 'actions',
              header: '',
              render: (p: any) =>
                can('CANTEEN_MANAGE') && (
                  <div className="flex justify-end gap-2">
                    <Button className="px-2.5 py-1 text-xs" variant="secondary" onClick={() => setEnrolling(p)}>
                      <Users size={14} /> Enrol a class
                    </Button>
                    <Button className="px-2.5 py-1 text-xs" variant="secondary" onClick={() => setEditing(p)}>
                      Edit
                    </Button>
                  </div>
                ),
            },
          ]}
          rows={data}
          loading={loading}
          emptyTitle="No canteen plans yet"
          emptyDescription="Create one plan per level or class, for example a KG plan at a lower daily rate and a JHS plan at a higher one."
        />
      </Card>
      {creating && (
        <PlanModal
          plan={null}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
      {editing && (
        <PlanModal
          plan={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {enrolling && (
        <EnrolModal
          plan={enrolling}
          onClose={() => setEnrolling(null)}
          onDone={() => {
            setEnrolling(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
