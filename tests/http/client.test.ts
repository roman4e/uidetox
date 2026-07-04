import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '../../src/http/client.js';
import { ApiError } from '../../src/http/errors.js';

function jsonResponse(body: unknown, init: { status?: number; ok?: boolean } = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? (status >= 200 && status < 300),
    status,
    async text() { return body === undefined ? '' : JSON.stringify(body); },
    async json() { return body; },
  } as unknown as Response;
}

describe('createHttpClient', () => {
  it('builds URL with query and returns parsed JSON', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ items: [1, 2] }));
    const api = createHttpClient('/api/v1', { fetch: fetchMock });
    const data = await api.get<{ items: number[] }>('/ingredients', { query: { q: 'salt', limit: 50 } });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/ingredients?q=salt&limit=50');
    expect(data.items).toEqual([1, 2]);
  });

  it('substitutes path params', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: '7' }));
    const api = createHttpClient('/api/v1', { fetch: fetchMock });
    await api.get('/dish/{id}', { path: { id: 7 } });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/dish/7');
  });

  it('sends JSON body with content-type on POST', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }, { status: 201 }));
    const api = createHttpClient('/api/v1', { fetch: fetchMock });
    await api.post('/ingredients', { body: { name: 'Salt' } });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'Salt' }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('injects Authorization header from getAccessToken', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}));
    const api = createHttpClient('/api/v1', {
      fetch: fetchMock,
      auth: { getAccessToken: () => 'tok123' },
    });
    await api.get('/me');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok123');
  });

  it('throws ApiError with status on non-ok', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ message: 'nope' }, { status: 400 }));
    const api = createHttpClient('/api/v1', { fetch: fetchMock });
    await expect(api.get('/x')).rejects.toMatchObject({ status: 400, message: 'nope' });
    await expect(api.get('/x')).rejects.toBeInstanceOf(ApiError);
  });

  it('runs request interceptors that mutate headers', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}));
    const api = createHttpClient('/api/v1', {
      fetch: fetchMock,
      interceptors: [{ onRequest: (ctx) => { ctx.headers['X-Trace'] = 'abc'; } }],
    });
    await api.get('/x');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-Trace']).toBe('abc');
  });

  it('passes the abort signal through to fetch', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}));
    const api = createHttpClient('/api/v1', { fetch: fetchMock });
    const ctrl = new AbortController();
    await api.get('/x', { signal: ctrl.signal });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(ctrl.signal);
  });

  it('returns undefined for 204 No Content', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(undefined, { status: 204 }));
    const api = createHttpClient('/api/v1', { fetch: fetchMock });
    expect(await api.delete('/x/{id}', { path: { id: 1 } })).toBeUndefined();
  });
});
