import { describe, expect, it, vi } from 'vitest';
import { command } from '../../src/http/command.js';
import type { HttpClient } from '../../src/http/client.js';

function fakeClient(impl: (path: string, params: unknown) => Promise<unknown>): HttpClient {
  const post = vi.fn(impl);
  return { post, request: post, get: post, put: post, patch: post, delete: post } as unknown as HttpClient;
}

describe('command()', () => {
  it('posts the envelope with an idempotency key and resolves on ack', async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    const client = fakeClient(async (path, params) => {
      calls.push({ path, body: (params as { body: unknown }).body });
      return { ok: true };
    });
    const reorder = command(
      (a: { artifact: string; rank: string }) => ({ command: 'artifact.reorder', payload: { artifact: a.artifact, rank: a.rank } }),
      { endpoint: '/api/commands', client },
    );
    const res = await reorder.run({ artifact: 'a1', rank: 'h' });
    expect(res).toEqual({ ok: true });
    expect(calls[0].path).toBe('/api/commands');
    const body = calls[0].body as { command: string; payload: unknown; idempotency_key: string };
    expect(body.command).toBe('artifact.reorder');
    expect(body.payload).toEqual({ artifact: 'a1', rank: 'h' });
    expect(typeof body.idempotency_key).toBe('string');
    expect(body.idempotency_key.length).toBeGreaterThan(0);
  });

  it('omits idempotency_key when idempotent:false', async () => {
    let body: Record<string, unknown> = {};
    const client = fakeClient(async (_p, params) => { body = (params as { body: Record<string, unknown> }).body; return {}; });
    await command((a: object) => ({ command: 'x', payload: a }), { client, idempotent: false }).run({});
    expect('idempotency_key' in body).toBe(false);
  });

  it('applies optimistic before the request and rolls back on failure', async () => {
    const store = { rank: 'a' };
    const client = fakeClient(async () => { throw new Error('server 500'); });
    const cmd = command(
      (a: { rank: string }) => ({ command: 'move', payload: a }),
      {
        client,
        optimistic: (a, patch) => { patch.prev = store.rank; store.rank = a.rank; },
        rollback: (_a, patch) => { store.rank = patch.prev as string; },
      },
    );
    expect(cmd.pending).toBe(false);
    await expect(cmd.run({ rank: 'z' })).rejects.toThrow('server 500');
    expect(store.rank).toBe('a');        // rolled back
    expect((cmd.error as Error).message).toBe('server 500');
    expect(cmd.pending).toBe(false);
  });

  it('toggles pending around the in-flight request', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const client = fakeClient(async () => { await gate; return {}; });
    const cmd = command((a: object) => ({ command: 'x', payload: a }), { client });
    const p = cmd.run({});
    expect(cmd.pending).toBe(true);
    release();
    await p;
    expect(cmd.pending).toBe(false);
  });
});
