import { serializeQuery } from './serialize.js';
import { ApiError, normalizeError } from './errors.js';

export interface AuthConfig {
  getAccessToken?: () => string | null | undefined;
  /** Called on 401; returns a fresh access token or null if refresh failed. */
  onRefresh?: () => Promise<string | null>;
}

export interface RequestContext {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface Interceptor {
  onRequest?: (ctx: RequestContext) => void | Promise<void>;
  onResponse?: (response: Response, ctx: RequestContext) => void | Promise<void>;
}

export interface HttpClientOptions {
  auth?: AuthConfig;
  interceptors?: Interceptor[];
  headers?: Record<string, string>;
  /** Override for tests / non-browser runtimes. Defaults to global `fetch`. */
  fetch?: typeof fetch;
  /** Emitted when refresh fails terminally (T4). */
  onAuthExpired?: () => void;
}

export interface RequestParams {
  path?: Record<string, string | number>;
  query?: Record<string, unknown>;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function buildUrl(baseUrl: string, path: string, params: RequestParams): string {
  let resolved = path.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = params.path?.[k];
    if (v === undefined) throw new Error(`Missing path param: ${k}`);
    return encodeURIComponent(String(v));
  });
  const qs = params.query ? serializeQuery(params.query) : '';
  if (qs) resolved += (resolved.includes('?') ? '&' : '?') + qs;
  const base = baseUrl.replace(/\/$/, '');
  return resolved.startsWith('http') ? resolved : base + (resolved.startsWith('/') ? '' : '/') + resolved;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return text; }
}

export interface HttpClient {
  request<T = unknown>(method: HttpMethod, path: string, params?: RequestParams): Promise<T>;
  get<T = unknown>(path: string, params?: RequestParams): Promise<T>;
  post<T = unknown>(path: string, params?: RequestParams): Promise<T>;
  put<T = unknown>(path: string, params?: RequestParams): Promise<T>;
  patch<T = unknown>(path: string, params?: RequestParams): Promise<T>;
  delete<T = unknown>(path: string, params?: RequestParams): Promise<T>;
}

export function createHttpClient(baseUrl: string, opts: HttpClientOptions = {}): HttpClient {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const interceptors = opts.interceptors ?? [];

  // 401 refresh state (single in-flight; queued retries) — T4.
  let refreshing: Promise<string | null> | null = null;

  async function refreshToken(): Promise<string | null> {
    if (!opts.auth?.onRefresh) return null;
    if (!refreshing) {
      refreshing = opts.auth.onRefresh().finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function send(method: HttpMethod, path: string, params: RequestParams, retry: boolean): Promise<Response> {
    const url = buildUrl(baseUrl, path, params);
    const headers: Record<string, string> = { ...opts.headers, ...params.headers };
    const token = opts.auth?.getAccessToken?.();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const hasBody = params.body !== undefined && method !== 'GET';
    if (hasBody && headers['Content-Type'] === undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const ctx: RequestContext = { method, url, headers, body: params.body };
    for (const it of interceptors) await it.onRequest?.(ctx);

    const response = await doFetch(ctx.url, {
      method,
      headers: ctx.headers,
      body: hasBody ? JSON.stringify(params.body) : undefined,
      signal: params.signal,
    });
    for (const it of interceptors) await it.onResponse?.(response, ctx);

    if (response.status === 401 && retry && opts.auth?.onRefresh) {
      const fresh = await refreshToken();
      if (fresh) {
        const retried = await send(method, path, params, false);
        if (retried.status === 401) opts.onAuthExpired?.();
        return retried;
      }
      opts.onAuthExpired?.();
    }
    return response;
  }

  async function request<T>(method: HttpMethod, path: string, params: RequestParams = {}): Promise<T> {
    const response = await send(method, path, params, true);
    if (!response.ok) throw await normalizeError(response);
    return (await parseBody(response)) as T;
  }

  return {
    request,
    get: (p, params) => request('GET', p, params),
    post: (p, params) => request('POST', p, params),
    put: (p, params) => request('PUT', p, params),
    patch: (p, params) => request('PATCH', p, params),
    delete: (p, params) => request('DELETE', p, params),
  };
}

export { ApiError };
