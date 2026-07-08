# REQ-24 — Typed CQRS command + resource helper

**Requested by:** SOPP / ALM frontend
**Priority:** **P2** — quality-of-life. The app works today with hand-rolled
fetch wrappers; this removes boilerplate and standardises optimistic updates.

## Context

SOPP's backend is CQRS: **all writes** go through `POST /commands` with
`{ command, payload, idempotency_key }`, and **reads** are normalised
projections (`GET /views/{id}/state`, `GET /search`, …). Every SOPP view repeats
the same two shapes:

1. load a projection into signal state (with loading/error/stale status);
2. fire a named command, optimistically patch local state, roll back on error.

UIDetox already ships `resource()` and `createHttpClient` (§18) for (1). (2) —
the named-command dispatch with idempotency + optimistic rollback — has no
first-class helper.

## Request

A small `command()` helper alongside `resource()`:

```ts
import { command } from 'uidetox/http';

const reorder = command(
  (args: { view: string; artifact: string; rank: string }) => ({
    command: 'artifact.reorder',
    payload: { view: `view:${args.view}`, artifact: `artifact:${args.artifact}`, rank: args.rank },
  }),
  {
    endpoint: '/api/commands',
    idempotent: true,                 // auto-mint idempotency_key (crypto.randomUUID)
    optimistic: (args, patch) => { … }, // apply to local signal state
    rollback: (args, patch) => { … },   // undo if the command 4xx/5xx
  },
);

await reorder.run({ view, artifact, rank }); // resolves on ack, rolls back on error
reorder.pending; // signal
```

Behaviour:

- Wraps the POST, injects `idempotency_key` when `idempotent`.
- Runs `optimistic` before the request, `rollback` on failure; both get a small
  patch handle so the caller mutates signal state without threading refs.
- Surfaces `pending` / `error` signals for buttons to bind `?disabled`.
- Plays with the §18 http client's 401-refresh + `ApiError` handling.

## Acceptance

- `command(...).run(args)` posts the right envelope with an idempotency key.
- A rejected command invokes `rollback` and rejects the returned promise.
- `pending` toggles around the in-flight request.
