import { state } from '../runtime/state.js';
import type { HttpClient } from './client.js';

/** A shared per-run scratch object: `optimistic` stashes undo info, `rollback` reads it. */
export type CommandPatch = Record<string, unknown>;

export interface CommandEnvelope {
  command: string;
  payload: unknown;
}

export interface CommandOptions<A> {
  /** Commands endpoint (default '/api/commands'). */
  endpoint?: string;
  /** Auto-mint an `idempotency_key` on the envelope. Default true. */
  idempotent?: boolean;
  /** HTTP client for 401-refresh + ApiError; falls back to `fetch` when absent. */
  client?: HttpClient;
  /** Applied before the request; stash undo info on `patch`. */
  optimistic?: (args: A, patch: CommandPatch) => void;
  /** Applied if the request fails; undo using `patch`. */
  rollback?: (args: A, patch: CommandPatch) => void;
  onSuccess?: (result: unknown, args: A) => void;
}

export interface CommandHandle<A, R> {
  run(args: A): Promise<R>;
  readonly pending: boolean;
  readonly error: unknown;
}

function uuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e9).toString(16)}`;
}

async function postPlain(endpoint: string, body: unknown): Promise<unknown> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`command failed: HTTP ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : undefined;
}

/**
 * A named CQRS command dispatcher: posts `{ command, payload, idempotency_key? }`,
 * applies an optimistic patch before the request and rolls it back on failure,
 * and exposes reactive `pending` / `error`.
 */
export function command<A, R = unknown>(
  builder: (args: A) => CommandEnvelope,
  opts: CommandOptions<A> = {},
): CommandHandle<A, R> {
  const endpoint = opts.endpoint ?? '/api/commands';
  const idempotent = opts.idempotent ?? true;
  const store = state<{ pending: boolean; error: unknown }>({ pending: false, error: undefined });

  return {
    get pending() { return store.pending; },
    get error() { return store.error; },
    async run(args: A): Promise<R> {
      const patch: CommandPatch = {};
      opts.optimistic?.(args, patch);
      store.pending = true;
      store.error = undefined;
      try {
        const env = builder(args);
        const body: Record<string, unknown> = { command: env.command, payload: env.payload };
        if (idempotent) body.idempotency_key = uuid();
        const result = opts.client
          ? await opts.client.post<R>(endpoint, { body })
          : (await postPlain(endpoint, body)) as R;
        opts.onSuccess?.(result, args);
        return result;
      } catch (err) {
        opts.rollback?.(args, patch);
        store.error = err;
        throw err;
      } finally {
        store.pending = false;
      }
    },
  };
}
