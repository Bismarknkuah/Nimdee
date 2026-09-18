'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, session, tokens } from './api';
import { currentSlug } from './tenant';

export interface Me {
  type: 'TENANT' | 'PLATFORM';
  user: any;
  roles?: string[];
  permissions?: string[];
  isSupportSession?: boolean;
  links?: { staffId: string | null; guardianId: string | null; studentId: string | null };
  tenant?: any;
  features?: string[];
  subscription?: any;
}

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  login: (school: string, email: string, password: string) => Promise<Me>;
  platformLogin: (email: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  refresh: () => Promise<Me | null>;
  can: (...perms: string[]) => boolean;
  has: (feature: string) => boolean;
  role: 'admin' | 'proprietor' | 'teacher' | 'parent' | 'student' | 'finance' | 'canteen' | 'platform' | null;
}

const Ctx = createContext<AuthCtx>(null as any);

function applyBranding(t?: any) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const primary = t?.primaryColor || '#1d4ed8';
  const dark = shade(primary, -0.22),
    soft = shade(primary, 0.85);
  root.style.setProperty('--brand', primary);
  root.style.setProperty('--brand-rgb', rgb(primary));
  root.style.setProperty('--brand-dark', dark);
  root.style.setProperty('--brand-dark-rgb', rgb(dark));
  root.style.setProperty('--brand-soft', soft);
  root.style.setProperty('--brand-soft-rgb', rgb(soft));
  if (t?.fontFamily) root.style.setProperty('--font-sans', t.fontFamily);
}
export function rgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}` : '29 78 216';
}
export function shade(hex: string, amount: number) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const f = (c: string) => {
    const v = parseInt(c, 16);
    const n = amount < 0 ? Math.round(v * (1 + amount)) : Math.round(v + (255 - v) * amount);
    return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  };
  return `#${f(m[1])}${f(m[2])}${f(m[3])}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(() => session.get());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokens.access) {
      setMe(null);
      setLoading(false);
      return null;
    }
    try {
      const data = await api.get<Me>('/auth/me');
      session.set(data);
      setMe(data);
      applyBranding(data.tenant);
      return data;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (me?.tenant) applyBranding(me.tenant);
    refresh();
  }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (school: string, email: string, password: string) => {
    const data = await api.public.post('/auth/login', {
      school,
      email,
      password,
      deviceName: navigator.userAgent.slice(0, 60),
    });
    tokens.set(data.accessToken, data.refreshToken);
    localStorage.setItem('schoolos.slug', data.tenant.slug);
    const m = await api.get<Me>('/auth/me');
    session.set(m);
    setMe(m);
    applyBranding(m.tenant);
    return m;
  }, []);

  const platformLogin = useCallback(async (email: string, password: string) => {
    const data = await api.public.post('/auth/platform/login', { email, password });
    tokens.set(data.accessToken, data.refreshToken);
    const m = await api.get<Me>('/auth/me');
    session.set(m);
    setMe(m);
    applyBranding();
    return m;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', { refreshToken: tokens.refresh });
    } catch {
      /* ignore */
    }
    const isPlatform = me?.type === 'PLATFORM';
    tokens.clear();
    setMe(null);
    window.location.href = isPlatform ? '/platform/login' : '/login';
  }, [me]);

  const can = useCallback(
    (...perms: string[]) => {
      const p = me?.permissions ?? [];
      return p.includes('*') || perms.some((x) => p.includes(x));
    },
    [me],
  );
  const has = useCallback((feature: string) => (me?.features ?? []).includes(feature), [me]);
  const role = useMemo<AuthCtx['role']>(() => {
    if (!me) return null;
    if (me.type === 'PLATFORM') return 'platform';
    const roles = me.roles ?? [];
    const ut = me.user?.userType;
    if (ut === 'PARENT') return 'parent';
    if (ut === 'STUDENT') return 'student';
    if (roles.includes('Proprietor')) return 'proprietor';
    if (
      roles.includes('School Admin') ||
      roles.includes('Headmaster') ||
      roles.includes('Academic Head') ||
      can('SCHOOL_MANAGE')
    )
      return 'admin';
    if (roles.includes('Accountant') || roles.includes('Cashier') || can('PAYMENT_RECORD', 'FEES_MANAGE'))
      return 'finance';
    if (roles.includes('Canteen Manager') || can('CANTEEN_SELL')) return 'canteen';
    return 'teacher';
  }, [me, can]);

  const value = useMemo(
    () => ({ me, loading, login, platformLogin, logout, refresh, can, has, role }),
    [me, loading, login, platformLogin, logout, refresh, can, has, role],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export const dashboardFor = (role: AuthCtx['role']) =>
  role === 'platform' ? '/platform' : role ? `/school/dashboards/${role}` : '/login';
export { currentSlug };
