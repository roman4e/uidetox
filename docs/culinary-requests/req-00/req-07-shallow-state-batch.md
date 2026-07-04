# REQ-07 — `shallow()` state + Explicit `batch()` / Transaction API

**Requested by:** Culinary frontend
**Priority:** P2 (measure first; may not be needed if deep Proxy performs)
**Estimated effort:** small (2-4 days)

## Purpose

Give the author two escape hatches when default deep-reactive state becomes expensive:

1. **`shallow(obj)`** — a reactive container that tracks only top-level keys, treats nested values as opaque. Ideal for large payloads that are replaced wholesale (recompute results, graph snapshots).
2. **`batch(fn)`** — group multiple mutations into a single flush; all subscribers see the final state exactly once, not once per intermediate write.

## Motivating use cases from Culinary

1. **Live graph recompute payload** — server returns `{ nodes: [...500 items with computed_nutrients JSON blobs], aggregate: {...} }`. Deep-proxying every nested nutrient object is wasted work — the consumer only ever reads them, never mutates. `shallow()` avoids per-property Proxy alloc and per-property tracking.
2. **Bulk graph update from editor** — dragging a node updates position + triggers recompute. Fifty writes across three signals should produce ONE UI flush, not fifty scheduled flushes coalesced by rAF (rAF coalesces re-runs, but observer notifications still fan out per key).
3. **Undo / redo** — restore a snapshot. Replacing the whole graph state is one logical write; subscribers must see it once.
4. **Similarity-search results** — replace the whole candidate list on every debounced keystroke.

## Proposed API

### `shallow`

```ts
import { shallow } from 'uidetox';

const g = shallow({
  nodes: [] as Node[],
  edges: [] as Edge[],
  aggregate: null as Aggregate | null,
});

// Reads track the top-level key only:
effect(() => console.log(g.nodes.length));   // depends on `nodes` slot

// Replacing the reference triggers subscribers:
g.nodes = fresh;                             // ✅ effect re-runs

// Mutating inside a shallow value does NOT trigger:
g.nodes.push(x);                             // ⚠️  no effect re-run — author's responsibility
```

Contract:
- Only own enumerable properties of the passed object are proxied.
- Nested values returned as-is (not re-wrapped).
- Setting a property triggers subscribers exactly like `state()`.
- Deleting a property triggers subscribers.
- If the author needs mutation-visibility on a nested list, wrap the list itself with `state()` and assign it into the slot.

### `batch`

```ts
import { batch } from 'uidetox';

batch(() => {
  g.nodes = newNodes;
  g.edges = newEdges;
  g.aggregate = newAggregate;
});
// One flush at the end. Subscribers to any of the three keys re-run exactly once
// each, and only after all three writes completed.
```

Contract:
- Nested `batch()` is flat (inner batch does not create a checkpoint; outermost frame owns the flush).
- If `fn` throws, still flush queued jobs (or roll back — pick one and document; recommend flush for MVP simplicity).
- Reading inside `batch` returns the *current* (post-write) value, not a snapshot. This matches SolidJS `batch()` semantics.

### `untracked(fn)` bonus

Not strictly needed but small:

```ts
import { untracked } from 'uidetox';

effect(() => {
  const size = g.nodes.length;              // tracked
  const dbg = untracked(() => JSON.stringify(g.edges));  // not tracked
});
```

Prevents accidental subscription in logging/debug reads.

### `deepEqual` opt-out for `state()` sets

Sometimes a write with an equal value should not notify. `state()` already uses `Object.is` to skip primitive no-ops. For object equality, consumer opts in:

```ts
import { setDeepEqual } from 'uidetox';
const s = state({ big: { a: 1 } });
setDeepEqual(s, 'big', true);        // subsequent writes are compared with deep equality
```

Optional, defer if implementation cost is high.

## Acceptance criteria

- [ ] `shallow(obj)` returns a Proxy that tracks only top-level keys. Confirmed via test that mutating nested does NOT re-run effects.
- [ ] `batch(fn)` collapses multiple writes across multiple state containers into a single flush.
- [ ] Reads inside `batch` see current post-write values.
- [ ] Nested batches flatten.
- [ ] `untracked(fn)` returns fn's value without subscribing observer to reads inside.
- [ ] Perf test / micro-benchmark: setting 500 nodes via `shallow({nodes})` allocates < 5 % of what deep `state()` allocates (measure via `performance.now()` and node count via WeakRef sampling).
- [ ] Docs page explaining when to use `shallow` vs `state`, and what `batch` guarantees.

## Open questions

1. Should `shallow()` return the same object instance every read (like `state()` does today via `proxies` WeakMap) or a fresh view? Consistent identity preferred.
2. `batch()` inside an effect body — does the effect subscribe to ALL keys read during the batch or only to the ones read post-batch? Suggest: same as no-batch — subscribes to whatever it reads. Batch does not change tracking, only flush timing.
