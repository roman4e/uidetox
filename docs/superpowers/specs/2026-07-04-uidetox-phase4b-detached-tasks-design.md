# UIDetox Phase 4b — Detached Task Blocks

**Status:** Draft (v0.1)
**Date:** 2026-07-04
**Depends on:** Phase 0 (observer/effect), Phase 3a (scheduler), Phase 4a (DSL sections), REQ-04 (ctx lifecycle).

## 1. Purpose

Add a `task` block: a detached, async side-effect unit for work **not related to rendering** — fetch, websockets, timers, analytics. It is reactive (re-runs when tracked signals change) but scheduled off the render frame, never blocking paint, with automatic cancellation of the previous run (last-wins).

## 2. Difference from render reactivity

| | Frame reactivity (effect/derived/bindings) | Detached task |
|---|---|---|
| Scheduling | rAF-bound phases (compute/effects/reads/renders) | microtask (default) or idle |
| Purpose | DOM sync, derived values | fetch, subscriptions, background work |
| Blocks paint | no (batched) | never in a frame at all |
| Cancellation | n/a | AbortSignal, previous run aborted on re-run |

UIDetox does not need React-style effects for DOM sync (bindings do that). `task` is only for non-render side-effects.

## 3. Runtime API

```ts
task(fn: (signal: AbortSignal) => void | Promise<void>, opts?: { idle?: boolean }): () => void
```

- Runs `fn` asynchronously (initial run on a microtask, not synchronously at mount).
- Tracks signals **read synchronously before the first `await`** (same tracking boundary as `effect`). Reads after an `await` are not tracked.
- On a tracked change, schedules a re-run (microtask default; `idle` → `requestIdleCallback`). Multiple changes in a tick coalesce into one re-run.
- Before each re-run the previous `AbortController` is aborted; `fn` receives the fresh `signal`. Authors pass it to `fetch` and/or check `signal.aborted` before writing state (last-wins).
- Returns a dispose function; disposing aborts the in-flight run and stops re-runs.

## 4. Component integration

- `ctx.task(fn, opts)` — instance-scoped; disposed on unmount (like `ctx.effect`).
- DSL `task` section compiles to `ctx.task(async (signal) => { <body> }, { idle: <bool> })`.
- `task idle` modifier → idle scheduling.

```
component ProductList tag product-list

script
const filter = state({ q: '' });
const items = state({ list: [] });
end script

task
const q = filter.q;                 // tracked (read before await)
const res = await fetch(`/api/products?q=${q}`, { signal });
if (!signal.aborted) items.list = await res.json();
end task

template
<ul>
  <for each=${items.list} item="p" key="p.id"><li>${p.name}</li></for>
</ul>
end template

end component
```

## 5. Non-Goals

- Retry / backoff policies — future.
- Task result caching (SWR) — future (REQ-02 territory).
- Cross-component shared tasks — future.

## 6. File Layout

```
src/runtime/task.ts            # NEW — task primitive
src/runtime/component.ts       # MODIFIED — ctx.task, disposed on unmount
src/runtime/index.ts           # MODIFIED — export task
src/compiler/dtx/lines.ts      # MODIFIED — `task` section keyword + idle modifier
src/compiler/dtx/types.ts      # MODIFIED — Member.kind adds 'task'
src/compiler/dtx/parse.ts      # MODIFIED — section kind mapping
src/compiler/dtx/component.ts  # MODIFIED — emit ctx.task wrapper
tests/runtime/task.test.ts
tests/e2e/dtx-task.test.ts
```
