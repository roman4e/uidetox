# UIDetox Phase 3e — Async Measure Queue

**Status:** Draft (v0.1)
**Date:** 2026-07-03
**Depends on:** Phase 3a (frame scheduler), Phase 3b (measure/mutate).

## 1. Purpose

Add a batched read phase to the frame scheduler so many DOM measurements in one tick force layout at most once, following the FastDOM read-before-write discipline.

## 2. Frame Phases (updated)

```
rAF tick:
  1. derivations   — pure recompute
  2. effects       — user side effects (may scheduleRead + mutate)
  3. reads         — NEW: batched DOM measurements, one forced layout
  4. renders       — commit staged mutations
  5. frameEnd
```

The `reads` queue drains between `effects` and `renders`. Because it runs before the commit, batched reads observe the previously-committed DOM (this frame's staged writes are not yet applied) — the correct "First" state for FLIP and the classic read-before-write ordering that prevents layout thrashing.

## 3. API

- `scheduleRead(fn: () => void): void` — internal; enqueue a read job.
- `readFrame<T>(fn: () => T): Promise<T>` — public. Runs `fn` in the next read phase, resolves with its result. Multiple `readFrame` calls in one tick batch into a single read phase.

`measure(fn)` (Phase 3b) is unchanged — synchronous, commits stage then reads, sees pending mutations. Use it for imperative code that needs the value immediately; use `readFrame` for batched, thrash-free measurement.

## 4. Semantics contrast

| API | Timing | Sees pending writes | Layout cost |
|---|---|---|---|
| `measure(fn)` | synchronous | yes (commits first) | forces layout now |
| `readFrame(fn)` | next read phase | no (pre-commit) | shared across the batch |

## 5. Non-Goals

- Paired read→write API (`readThenWrite`) — future.
- Read-result caching across frames — future.

## 6. File Layout

```
src/runtime/scheduler.ts          # add reads queue + scheduleRead + readFrame
tests/runtime/scheduler-reads.test.ts
```
