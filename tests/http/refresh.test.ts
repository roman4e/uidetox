import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '../../src/http/client.js';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return body === undefined ? '' : JSON.stringify(body); },
    async json() { return body; },
  } as unknown as Response;
}

describe('401 refresh flow', () => {
  it('refreshes once and retries the original request', async () => {
    const store = { access: 'old' };
    let calls = 0;
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      calls++;
      const auth = (init.headers as Record<string, string>)['Authorization'];
      return auth === 'Bearer new' ? jsonResponse({ ok: true }) : jsonResponse({ message: 'expired' }, 401);
    });
    const onRefresh = vi.fn(async () => { store.access = 'new'; return 'new'; });
    const api = createHttpClient('/api', {
      fetch: fetchMock,
      auth: { getAccessToken: () => store.access, onRefresh },
    });
    const data = await api.get<{ ok: boolean }>('/me');
    expect(data.ok).toBe(true);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(calls).toBe(2); // original 401 + retry
  });

  it('shares a single in-flight refresh across concurrent 401s', async () => {
    const store = { access: 'old' };
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>)['Authorization'];
      return auth === 'Bearer new' ? jsonResponse({ ok: true }) : jsonResponse({}, 401);
    });
    let refreshes = 0;
    const onRefresh = vi.fn(async () => {
      refreshes++;
      await Promise.resolve();
      store.access = 'new';
      return 'new';
    });
    const api = createHttpClient('/api', {
      fetch: fetchMock,
      auth: { getAccessToken: () => store.access, onRefresh },
    });
    const [a, b] = await Promise.all([api.get('/a'), api.get('/b')]);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(refreshes).toBe(1);
  });

  it('emits auth:expired when refresh fails', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ message: 'expired' }, 401));
    const onAuthExpired = vi.fn();
    const api = createHttpClient('/api', {
      fetch: fetchMock,
      auth: { getAccessToken: () => 'old', onRefresh: async () => null },
      onAuthExpired,
    });
    await expect(api.get('/me')).rejects.toMatchObject({ status: 401 });
    expect(onAuthExpired).toHaveBeenCalledTimes(1);
  });

  it('emits auth:expired when the retry is still 401', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 401));
    const onAuthExpired = vi.fn();
    const api = createHttpClient('/api', {
      fetch: fetchMock,
      auth: { getAccessToken: () => 'x', onRefresh: async () => 'new' },
      onAuthExpired,
    });
    await expect(api.get('/me')).rejects.toMatchObject({ status: 401 });
    expect(onAuthExpired).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
