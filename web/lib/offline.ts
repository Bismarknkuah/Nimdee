'use client';
/**
 * Offline-first support: an IndexedDB queue of operations (attendance marks, student edits) that is
 * pushed to /sync/push whenever connectivity returns, plus a local cache of the last /sync/pull snapshot.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export interface QueuedOp {
  operationId: string;
  entity: 'attendance' | 'student';
  action: string;
  payload: any;
  clientTimestamp: string;
  status: 'PENDING' | 'FAILED' | 'CONFLICT';
  error?: string;
  attempts: number;
  label: string;
}
interface Schema extends DBSchema {
  ops: { key: string; value: QueuedOp };
  cache: { key: string; value: any };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;
const db = () =>
  (dbp ??= openDB<Schema>('schoolos', 1, {
    upgrade(d) {
      d.createObjectStore('ops', { keyPath: 'operationId' });
      d.createObjectStore('cache');
    },
  }));
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export async function queueOp(entity: QueuedOp['entity'], action: string, payload: any, label: string) {
  const op: QueuedOp = {
    operationId: uuid(),
    entity,
    action,
    payload,
    clientTimestamp: new Date().toISOString(),
    status: 'PENDING',
    attempts: 0,
    label,
  };
  await (await db()).put('ops', op);
  notify();
  return op;
}
export async function pendingOps() {
  return (await db()).getAll('ops');
}
export async function removeOp(id: string) {
  await (await db()).delete('ops', id);
  notify();
}
export async function cacheSet(key: string, value: any) {
  await (await db()).put('cache', value, key);
}
export async function cacheGet<T = any>(key: string): Promise<T | undefined> {
  return (await db()).get('cache', key);
}

export async function ensureDevice(): Promise<string> {
  const existing = localStorage.getItem('schoolos.device');
  if (existing) return existing;
  const d = await api.post('/sync/devices/register', {
    name: `${navigator.platform || 'Web'} · ${new Date().toLocaleDateString()}`,
    platform: /Android/i.test(navigator.userAgent)
      ? 'ANDROID'
      : /iPhone|iPad/i.test(navigator.userAgent)
        ? 'IOS'
        : 'WEB',
  });
  localStorage.setItem('schoolos.device', d.id);
  return d.id;
}

/** Pushes the queue. Returns a summary; safe to call repeatedly. */
export async function syncNow(): Promise<{ applied: number; conflicts: number; failed: number; duplicate: number }> {
  const summary = { applied: 0, conflicts: 0, failed: 0, duplicate: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) return summary;
  const ops = (await pendingOps()).filter((o) => o.status !== 'CONFLICT' && o.attempts < 8);
  if (!ops.length) {
    // Nothing queued: only heartbeat if this browser already works offline (never register devices for users who don't).
    const existing = localStorage.getItem('schoolos.device');
    if (existing)
      await api.post('/sync/devices/heartbeat', { deviceId: existing, pendingCount: 0 }).catch(() => undefined);
    return summary;
  }
  const deviceId = await ensureDevice();
  for (let i = 0; i < ops.length; i += 50) {
    const batch = ops.slice(i, i + 50);
    const res = await api.post('/sync/push', {
      deviceId,
      pendingCount: Math.max(ops.length - i - batch.length, 0),
      operations: batch.map(({ operationId, entity, action, payload, clientTimestamp }) => ({
        operationId,
        entity,
        action,
        payload,
        clientTimestamp,
      })),
    });
    for (const r of res.results) {
      const op = batch.find((o) => o.operationId === r.operationId)!;
      if (r.status === 'APPLIED' || r.status === 'DUPLICATE') {
        summary[r.status === 'APPLIED' ? 'applied' : 'duplicate']++;
        await removeOp(op.operationId);
      } else if (r.status === 'CONFLICT') {
        summary.conflicts++;
        await removeOp(op.operationId);
      } else {
        summary.failed++;
        await (await db()).put('ops', { ...op, status: 'FAILED', error: r.error, attempts: op.attempts + 1 });
      }
    }
  }
  localStorage.setItem('schoolos.lastSync', new Date().toISOString());
  notify();
  return summary;
}

/** Downloads (or refreshes) the offline snapshot of classes/students/attendance for this user. */
export async function pullSnapshot() {
  const data = await api.get('/sync/pull');
  await cacheSet('snapshot', data);
  localStorage.setItem('schoolos.lastPull', data.serverTime);
  return data;
}

export function useOffline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(
    typeof localStorage === 'undefined' ? null : localStorage.getItem('schoolos.lastSync'),
  );
  const refreshCount = useCallback(async () => {
    try {
      setPending((await pendingOps()).length);
    } catch {
      /* idb unavailable */
    }
  }, []);
  const sync = useCallback(async () => {
    if (syncing) return null;
    setSyncing(true);
    try {
      const s = await syncNow();
      setLastSync(localStorage.getItem('schoolos.lastSync'));
      await refreshCount();
      return s;
    } catch {
      return null;
    } finally {
      setSyncing(false);
    }
  }, [syncing, refreshCount]);
  useEffect(() => {
    refreshCount();
    listeners.add(refreshCount);
    const on = () => {
      setOnline(true);
      sync();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const t = setInterval(() => {
      if (navigator.onLine) sync();
    }, 90_000);
    return () => {
      listeners.delete(refreshCount);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearInterval(t);
    };
  }, [refreshCount, sync]);
  return { online, pending, syncing, lastSync, sync };
}
