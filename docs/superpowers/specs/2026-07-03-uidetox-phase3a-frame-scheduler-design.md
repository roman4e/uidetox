# UIDetox Phase 3a — Frame Scheduler

**Status:** Draft (v0.1)
**Date:** 2026-07-03
**Depends on:** Phase 0 (existing scheduler + effect wiring).

## 1. Purpose

Replace the single-queue rAF scheduler with a three-phase scheduler that batches every reactive update into one browser paint frame, in a deterministic order that eliminates DOM thrashing.

## 2. Three Queues

Executed in order on every rAF tick:

1. **`derivations`** — recompute `derived()` values. Read-only. Runs first so downstream effects see consistent values.
2. **`effects`** — user `effect()` callbacks. May read and write state. May append to `renders` queue.
3. **`renders`** — pure DOM mutations queued by internal helpers (`__bind`, `__if`, `__for`, `__case`, etc.). Write-only; no state reads.

Each queue drains fully before the next starts. If a running job appends to an earlier queue, the earlier queue drains again after this queue finishes and before the next. Loop guard cap: 20 turns per frame.

## 3. Public API

- `scheduleDerivation(fn: () => void): void`
- `scheduleEffect(fn: () => void): void`
- `scheduleRender(fn: () => void): void`
- `onFrameEnd(fn: () => void): () => void` — one-shot; returns disposer.
- `nextFrame(): Promise<void>` — resolves after next drain.
- `flushSync(): void` — drains all queues immediately (test helper; unchanged surface).
- `scheduleFlush(fn: () => void): void` — deprecated; aliases `scheduleEffect`. Emits a one-time console warning per session.

## 4. Wiring changes

- `effect.ts` — `scheduled` job routes through `scheduleEffect`.
- `derived.ts` — the internal effect that keeps `.value` fresh routes through `scheduleDerivation`.
- `domHelpers.ts` — every `__bind` DOM mutation moves from `effect(...)` to a two-step pattern: an `effect` that captures the target value and queues a `scheduleRender` to apply it.

## 5. Deprecation Path

`scheduleFlush` remains callable indefinitely. First call each session logs:
```
[uidetox] scheduleFlush is deprecated, use scheduleEffect. It will be removed in a future release.
```

## 6. Non-Goals

- Priority hints per effect — future.
- Idle-time queue (`requestIdleCallback` backed) — future.
- Frame-timing metrics — future.

## 7. File Layout

```
src/runtime/scheduler.ts    # rewritten — three queues, onFrameEnd, nextFrame
src/runtime/effect.ts       # route to scheduleEffect
src/runtime/derived.ts      # route to scheduleDerivation
src/runtime/domHelpers.ts   # __bind writes via scheduleRender
tests/runtime/scheduler.test.ts   # updated + new phase-ordering tests
```
