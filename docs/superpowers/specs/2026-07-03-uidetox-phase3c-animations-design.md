# UIDetox Phase 3c — Animations

**Status:** Draft (v0.1)
**Date:** 2026-07-03
**Depends on:** Phase 3b (measure/mutate/stage).

## 1. Purpose

Build animation primitives on the DOM read/write scheduler: FLIP transitions, a Web Animations API wrapper, View Transitions integration, reduced-motion respect, and animation hooks in `<for>` list reconciliation.

## 2. Primitives

### 2.1 Reduced motion

`prefersReducedMotion(): boolean` — reads `matchMedia('(prefers-reduced-motion: reduce)')`; returns `false` when `matchMedia` is unavailable.

### 2.2 FLIP delta (pure)

`computeFlipDelta(first: Rect, last: Rect): FlipDelta` where `Rect = { x; y; width; height }` and `FlipDelta = { dx; dy; sx; sy }`. `dx = first.x - last.x`, `dy = first.y - last.y`, `sx = first.width / last.width`, `sy = first.height / last.height`. Zero-size guards: if `last.width` is 0, `sx = 1`.

### 2.3 WAAPI wrapper

`animate(el: Element, keyframes: Keyframe[], opts?: AnimateOptions): Animation | null` — thin wrapper over `el.animate`. Returns `null` when `element.animate` is unavailable or `prefersReducedMotion()` is true (in which case the final keyframe is applied instantly via `mutate`).

### 2.4 FLIP orchestrator

`flip(elements: Element[], mutateFn: () => void, opts?: FlipOptions): void`:
1. `measure` First rects of each element.
2. Run `mutateFn` (which changes the DOM) then `commitStage`.
3. `measure` Last rects.
4. For each element with a non-trivial delta: apply an inverting transform, then `animate` to identity. Respects reduced motion (skips to final).

### 2.5 View Transitions

`viewTransition(mutateFn: () => void | Promise<void>): Promise<void>` — calls `document.startViewTransition(mutateFn)` when available; otherwise runs `mutateFn` and resolves.

## 3. `<for>` Animation Hooks

`renderFor` gains an optional options object:

```ts
renderFor(parent, anchor, source, keyOf, bodyFactory, ctx, {
  onInsert?: (node: Node) => void,
  onRemove?: (node: Node, done: () => void) => void,
  onMove?: (node: Node) => void,
});
```

- `onInsert` — called after a new item node is inserted.
- `onRemove` — called instead of immediate removal; the reconciler defers actual `removeChild` until the hook calls `done()`.
- `onMove` — called after a retained node is repositioned (FLIP candidate).

Backwards compatible: omitting the options object preserves current behaviour.

## 4. Non-Goals

- Compiler `<insert>` / `<update>` / `<delete>` directive extraction — next phase.
- Spring physics — future.
- Timeline / scroll-driven animations — future.

## 5. File Layout

```
src/runtime/anim/
  reducedMotion.ts    # prefersReducedMotion
  flip.ts             # computeFlipDelta + flip
  animate.ts          # animate (WAAPI wrapper)
  viewTransition.ts   # viewTransition
  index.ts            # barrel
src/runtime/directives/forBlock.ts   # add optional hooks
tests/runtime/anim/*.test.ts
tests/runtime/forBlock-anim.test.ts
```
