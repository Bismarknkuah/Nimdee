'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import {
  Badge,
  Button,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchBox,
  Select,
  useToast,
} from '@/components/ui';

export default function InventoryPage() {
  const toast = useToast();
  const { me, can } = useAuth();
  const cur = me?.tenant?.currency ?? 'GHS';
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const { data, loading, reload } = useApi<any[]>(`/inventory/items${qs({ search: q })}`, [q]);
  const [modal, setModal] = useState<any>(null);
  const [move, setMove] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({});
  const [mf, setMf] = useState<any>({ type: 'IN', quantity: '', reason: '' });
  const save = async () => {
    setBusy(true);
    try {
      const body = {
        ...f,
        quantity: f.quantity === '' ? undefined : Number(f.quantity),
        minQuantity: Number(f.minQuantity || 0),
        unitCost: f.unitCost === '' ? undefined : Number(f.unitCost),
      };
      if (modal.id) {
        delete body.quantity;
        await api.patch(`/inventory/items/${modal.id}`, body);
      } else await api.post('/inventory/items', body);
      toast.success('Saved');
      setModal(null);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const doMove = async () => {
    setBusy(true);
    try {
      await api.post(`/inventory/items/${move.id}/move`, {
        type: mf.type,
        quantity: Number(mf.quantity),
        reason: mf.reason || undefined,
      });
      toast.success('Recorded');
      setMove(null);
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
        title="Inventory"
        subtitle="School assets, stationery and supplies"
        actions={
          can('INVENTORY_MANAGE') && (
            <Button
              onClick={() => {
                setF({
                  name: '',
                  category: 'GENERAL',
                  quantity: '',
                  minQuantity: 5,
                  unit: 'unit',
                  location: '',
                  unitCost: '',
                  supplier: '',
                });
                setModal({});
              }}
            >
              <Plus size={16} /> New item
            </Button>
          )
        }
      />
      <div className="mb-4 max-w-md">
        <SearchBox value={search} onChange={setSearch} />
      </div>
      <DataTable
        rows={data}
        loading={loading}
        columns={[
          { key: 'name', header: 'Item', render: (i: any) => <span className="font-medium">{i.name}</span> },
          { key: 'category', header: 'Category' },
          {
            key: 'quantity',
            header: 'Quantity',
            align: 'right',
            render: (i: any) => (
              <Badge tone={i.quantity <= i.minQuantity ? 'red' : 'emerald'}>{`${i.quantity} ${i.unit}`}</Badge>
            ),
          },
          { key: 'location', header: 'Location', render: (i: any) => i.location ?? '—' },
          {
            key: 'unitCost',
            header: 'Unit cost',
            align: 'right',
            render: (i: any) => (i.unitCost ? money(i.unitCost, cur) : '—'),
          },
          { key: 'supplier', header: 'Supplier', render: (i: any) => i.supplier ?? '—' },
          {
            key: 'x',
            header: '',
            render: (i: any) =>
              can('INVENTORY_MANAGE') && (
                <div className="flex gap-2 text-xs">
                  <button
                    className="text-brand hover:underline"
                    onClick={() => {
                      setMf({ type: 'IN', quantity: '', reason: '' });
                      setMove(i);
                    }}
                  >
                    Move
                  </button>
                  <button
                    className="text-brand hover:underline"
                    onClick={() => {
                      setF({
                        name: i.name,
                        category: i.category,
                        minQuantity: i.minQuantity,
                        unit: i.unit,
                        location: i.location ?? '',
                        unitCost: i.unitCost ? Number(i.unitCost) : '',
                        supplier: i.supplier ?? '',
                        quantity: '',
                      });
                      setModal(i);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="text-red-600 hover:underline"
                    onClick={async () => {
                      if (!confirm(`Delete ${i.name}?`)) return;
                      try {
                        await api.delete(`/inventory/items/${i.id}`);
                        reload();
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              ),
          },
        ]}
      />
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? 'Edit item' : 'New inventory item'}
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
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['name', 'Name'],
            ['category', 'Category'],
            ['unit', 'Unit'],
            ['location', 'Location'],
            ['supplier', 'Supplier'],
          ].map(([k, l]) => (
            <Field key={k} label={l}>
              <Input value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </Field>
          ))}
          {!modal?.id && (
            <Field label="Opening quantity">
              <Input
                type="number"
                value={f.quantity ?? ''}
                onChange={(e) => setF({ ...f, quantity: e.target.value })}
              />
            </Field>
          )}
          <Field label="Alert below">
            <Input
              type="number"
              value={f.minQuantity ?? ''}
              onChange={(e) => setF({ ...f, minQuantity: e.target.value })}
            />
          </Field>
          <Field label={`Unit cost (${cur})`}>
            <Input
              type="number"
              step="0.01"
              value={f.unitCost ?? ''}
              onChange={(e) => setF({ ...f, unitCost: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
      <Modal
        open={!!move}
        onClose={() => setMove(null)}
        title={move ? `Stock movement · ${move.name}` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMove(null)}>
              Cancel
            </Button>
            <Button onClick={doMove} loading={busy} disabled={!mf.quantity}>
              Record
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="Type">
            <Select
              value={mf.type}
              onChange={(e) => setMf({ ...mf, type: e.target.value })}
              options={[
                { value: 'IN', label: 'Received' },
                { value: 'OUT', label: 'Issued out' },
                { value: 'WASTE', label: 'Damaged / lost' },
                { value: 'ADJUST', label: 'Correction (+/−)' },
              ]}
            />
          </Field>
          <Field label="Quantity">
            <Input type="number" value={mf.quantity} onChange={(e) => setMf({ ...mf, quantity: e.target.value })} />
          </Field>
          <Field label="Reason">
            <Input value={mf.reason} onChange={(e) => setMf({ ...mf, reason: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
