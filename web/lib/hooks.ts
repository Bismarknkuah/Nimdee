'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';

/** Fetches `path` (GET) whenever it changes. Pass null to skip. */
export function useApi<T = any>(path: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    const my = ++seq.current;
    setLoading(true);
    try {
      const d = await api.get<T>(path);
      if (my === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e: any) {
      if (my === seq.current) setError(e);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    reload();
  }, [reload, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, loading, reload, setData };
}

export function useDebounce<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
