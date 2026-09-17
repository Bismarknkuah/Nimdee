'use client';
import { useApi } from './hooks';

/** Current academic year/term and the class list, shared by many screens. */
export function useAcademic() {
  const cur = useApi('/academic/current');
  const classes = useApi<any[]>('/academic/classes');
  return {
    year: cur.data?.year ?? null,
    term: cur.data?.term ?? null,
    terms: cur.data?.terms ?? [],
    classes: classes.data ?? [],
    loading: cur.loading || classes.loading,
    reload: () => {
      cur.reload();
      classes.reload();
    },
  };
}
export const classOptions = (classes: any[]) => classes.map((c) => ({ value: c.id, label: c.name }));
