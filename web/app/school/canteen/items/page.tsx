'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import { Badge, Button, Checkbox, DataTable, Field, Input, Modal, PageHeader, Select, useToast } from '@/components/ui';

export default function CanteenItems() {
  const toast = useToast();
  const { me, can } = useAuth();
  const cur = me?.tenant?.currency ?? 'GHS';
  const { data, loading, reload } = useApi<any[]>('/canteen/items?all=true');
  const [modal, setModal] = useState<any>(null);
  const [stock, setStock] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({});
  const [sf, setSf] = useState<any>({ type: 'IN', quantity: '', reason: '' });
  const save = async () => {
    setBusy(true);
    try {
      const body = {
        ...f,
        price: Number(f.price),
        stock: f.stock === '' ? undefined : Number(f.stock),
        minStock: Number(f.minStock || 0),
      };
      if (modal.id) {
        delete body.stock;
        await api.patch(`/canteen/items/${modal.id}`, body);
      } else await api.post('/canteen/items', body);
      toast.success('Saved');
      setModal(null);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const adjust = async () => {
    setBusy(true);
    try {
      await api.post(`/canteen/items/${stock.id}/stock`, {
        type: sf.type,
        quantity: Number(sf.quantity),
        reason: sf.reason || undefined,
      });
      toast.success('Stock updated');
      setStock(null);
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
        title="Canteen menu & stock"
        actions={
          can('CANTEEN_MANAGE') && (
            <Button
              onClick={() => {
                setF({ name: '', category: 'FOOD', price: '', stock: '', minStock: 10, unit: 'unit', isActive: true });
                setModal({});
              }}
            >
              <Plus size={16} /> New item
            </Button>
          )
        }
      />
      <DataTable
        rows={data}
        loading={loading}
        columns={[
          {
            key: 'name',
            header: 'Item',
            render: (i: any) => (
              <span className={!i.isActive ? 'text-slate-400 line-through' : 'font-medium'}>{i.name}</span>
            ),
          },
          { key: 'category', header: 'Category' },
          { key: 'price', header: 'Price', align: 'right', render: (i: any) => money(i.price, cur) },
          {
            key: 'stock',
            header: 'Stock',
            align: 'right',
            render: (i: any) => (
              <Badge tone={i.stock <= i.minStock ? 'red' : 'emerald'}>{`${i.stock} ${i.unit}`}</Badge>
            ),
          },
          { key: 'minStock', header: 'Min', align: 'right' },
          {
            key: 'x',
            header: '',
            render: (i: any) =>
              can('CANTEEN_MANAGE') && (
                <div className="flex gap-2 text-xs">
                  <button
                    className="text-brand hover:underline"
                    onClick={() => {
                      setSf({ type: 'IN', quantity: '', reason: '' });
                      setStock(i);
                    }}
                  >
                    Adjust stock
                  </button>
                  <button
                    className="text-brand hover:underline"
                    onClick={() => {
                      setF({
                        name: i.name,
                        category: i.category,
                        price: Number(i.price),
                        minStock: i.minStock,
                        unit: i.unit,
                        isActive: i.isActive,
                        stock: '',
                      });
                      setModal(i);
                    }}
                  >
                    Edit
                  </button>
                </div>
              ),
          },
        ]}
      />
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? 'Edit item' : 'New item'}
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
          <Field label="Name">
            <Input value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Category">
            <Input value={f.category ?? ''} onChange={(e) => setF({ ...f, category: e.target.value })} />
          </Field>
          <Field label={`Price (${cur})`}>
            <Input
              type="number"
              step="0.01"
              value={f.price ?? ''}
              onChange={(e) => setF({ ...f, price: e.target.value })}
            />
          </Field>
          <Field label="Unit">
            <Input value={f.unit ?? ''} onChange={(e) => setF({ ...f, unit: e.target.value })} />
          </Field>
          {!modal?.id && (
            <Field label="Opening stock">
              <Input type="number" value={f.stock ?? ''} onChange={(e) => setF({ ...f, stock: e.target.value })} />
            </Field>
          )}
          <Field label="Low-stock alert at">
            <Input type="number" value={f.minStock ?? ''} onChange={(e) => setF({ ...f, minStock: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox
              label="Available for sale"
              checked={!!f.isActive}
              onChange={(e) => setF({ ...f, isActive: e.target.checked })}
            />
          </div>
        </div>
      </Modal>
      <Modal
        open={!!stock}
        onClose={() => setStock(null)}
        title={stock ? `Adjust stock · ${stock.name} (${stock.stock} ${stock.unit})` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStock(null)}>
              Cancel
            </Button>
            <Button onClick={adjust} loading={busy} disabled={!sf.quantity}>
              Apply
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="Type">
            <Select
              value={sf.type}
              onChange={(e) => setSf({ ...sf, type: e.target.value })}
              options={[
                { value: 'IN', label: 'Stock in (purchase/delivery)' },
                { value: 'WASTE', label: 'Waste / spoilage' },
                { value: 'ADJUST', label: 'Correction (+/−)' },
              ]}
            />
          </Field>
          <Field label="Quantity">
            <Input type="number" value={sf.quantity} onChange={(e) => setSf({ ...sf, quantity: e.target.value })} />
          </Field>
          <Field label="Reason">
            <Input value={sf.reason} onChange={(e) => setSf({ ...sf, reason: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
