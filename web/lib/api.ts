'use client';
/**
 * Typed fetch wrapper for the Nimdee API: bearer auth, transparent refresh-token rotation,
 * consistent ApiError, blob downloads and multi-tenant aware login.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: any,
  ) {
    super(message);
  }
}

const KEYS = { access: 'schoolos.access', refresh: 'schoolos.refresh', session: 'schoolos.session' };
const isBrowser = typeof window !== 'undefined';

export const tokens = {
  get access() {
    return isBrowser ? localStorage.getItem(KEYS.access) : null;
  },
  get refresh() {
    return isBrowser ? localStorage.getItem(KEYS.refresh) : null;
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(KEYS.access, access);
    if (refresh) localStorage.setItem(KEYS.refresh, refresh);
  },
  clear() {
    [KEYS.access, KEYS.refresh, KEYS.session].forEach((k) => localStorage.removeItem(k));
  },
};

export const session = {
  get(): any | null {
    if (!isBrowser) return null;
    try {
      return JSON.parse(localStorage.getItem(KEYS.session) || 'null');
    } catch {
      return null;
    }
  },
  set(v: any) {
    localStorage.setItem(KEYS.session, JSON.stringify(v));
  },
};

let refreshing: Promise<boolean> | null = null;
async function refreshTokens(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const rt = tokens.refresh;
      if (!rt) return false;
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        tokens.set(data.accessToken, data.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => (refreshing = null), 0);
      }
    })();
  }
  return refreshing;
}

export function onUnauthorized() {
  tokens.clear();
  if (isBrowser && !location.pathname.startsWith('/login') && !location.pathname.startsWith('/platform/login')) {
    const isPlatform = location.pathname.startsWith('/platform');
    location.href = isPlatform ? '/platform/login' : `/login?next=${encodeURIComponent(location.pathname)}`;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: any,
  opts: { blob?: boolean; retry?: boolean; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const access = tokens.access;
  if (access && opts.auth !== false) headers.Authorization = `Bearer ${access}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch (e) {
    throw new ApiError(0, 'You appear to be offline. Changes will be queued where supported.', 'NETWORK');
  }
  if (res.status === 401 && opts.retry !== false && opts.auth !== false && access) {
    if (await refreshTokens()) return request<T>(method, path, body, { ...opts, retry: false });
    onUnauthorized();
  }
  if (opts.blob) {
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new ApiError(res.status, j.message || res.statusText, j.code, j.details);
    }
    return (await res.blob()) as any;
  }
  const text = await res.text();
  const data = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      })()
    : null;
  if (!res.ok)
    throw new ApiError(
      res.status,
      (data && data.message) || res.statusText || 'Request failed',
      data?.code,
      data?.details ?? data?.conflicts,
    );
  return data as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>('GET', path),
  post: <T = any>(path: string, body?: any) => request<T>('POST', path, body ?? {}),
  put: <T = any>(path: string, body?: any) => request<T>('PUT', path, body ?? {}),
  patch: <T = any>(path: string, body?: any) => request<T>('PATCH', path, body ?? {}),
  delete: <T = any>(path: string) => request<T>('DELETE', path),
  blob: (path: string) => request<Blob>('GET', path, undefined, { blob: true }),
  public: {
    get: <T = any>(path: string) => request<T>('GET', path, undefined, { auth: false }),
    post: <T = any>(path: string, body?: any) => request<T>('POST', path, body ?? {}, { auth: false }),
  },
};

export async function downloadBlob(path: string, filename: string) {
  const blob = await api.blob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function openBlob(path: string) {
  const blob = await api.blob(path);
  window.open(URL.createObjectURL(blob), '_blank');
}

export function qs(params: Record<string, any>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}
