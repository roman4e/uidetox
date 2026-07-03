# UIDetox Phase 3b — DOM Read/Write Scheduler

**Status:** Draft (v0.1)
**Date:** 2026-07-03
**Depends on:** Phase 3a (frame scheduler).

## 1. Purpose

Introduce a staged DOM commit layer so DOM work runs whenever code executes, changes are logically applied and measurable, but the real DOM mutation (what the browser paints) is committed only on the browser's `requestAnimationFrame`. Add batched layout measurement and offscreen measurement.

## 2. Model

```
Code runs any time:
  mutate(node, "text", "hi")     → stage buffer, NOT real DOM
  mutate(node, "class", "on")    → stage buffer (dedup by node+prop)

rAF from browser:
  commitStage()  → apply whole stage buffer to real DOM at once → one paint
```

## 3. Stage Buffer

- **Property ops** keyed by `(node, kind, name)` → last-write-wins dedup. Kinds: `text`, `attr`, `prop`, `boolean`, `style`.
- **Structural ops** (`insert`, `remove`, `move`) kept in an ordered list; applied in sequence after property ops.
- `commitStage()` applies everything and clears; scheduled once per frame via the Phase 3a render queue.

## 4. Read Semantics (variant C)

- **`readStaged(node, kind, name)`** — returns the pending staged value for logical properties (text/attr/prop/boolean/style) if present; otherwise `undefined`. No forced layout.
- **`measure(fn)`** — for layout geometry (`getBoundingClientRect`, `offsetWidth`, …). First calls `commitStage()` synchronously so pending mutations are applied, then runs `fn`. The read reflects all pending changes and forces at most one layout.

## 5. Offscreen Measure

- **`measureOffscreen(build, read)`** — creates a `position:absolute; left:-9999px; top:-9999px; visibility:hidden` container appended to `document.body`, appends `build()`'s node, forces layout, runs `read(node)`, removes the container, returns the read result. The element is fully laid out (measurable) but never visible.

## 6. Public API

- `mutate(node, kind, name, value): void`
- `mutateStructural(op): void`
- `readStaged(node, kind, name): unknown | undefined`
- `commitStage(): void`
- `commitSync(): void` — alias for tests: commit stage + flush scheduler.
- `measure<T>(fn: () => T): T`
- `measureOffscreen<T>(build: () => Node, read: (el: Element) => T): T`

## 7. Integration

- `__bind` re-runs move from `scheduleRender(directWrite)` to `mutate(...)` staging. First mount stays a synchronous direct write.
- The stage commit registers itself as one render-queue job (`scheduleRender(commitStage)`), so it rides the existing three-phase frame.

## 8. Non-Goals (this phase)

- FLIP / WAAPI / View Transitions — next phase, built on `measure` + `mutate`.
- `<insert>` / `<update>` / `<delete>` list animations — next phase.
- DOM-read batching into an async measure queue — `measure` is synchronous for now.

## 9. File Layout

```
src/runtime/dom/
  stage.ts        # buffer + mutate + readStaged + commitStage
  measure.ts      # measure + measureOffscreen
  index.ts        # barrel
src/runtime/domHelpers.ts   # __bind uses stage
tests/runtime/dom/stage.test.ts
tests/runtime/dom/measure.test.ts
```
