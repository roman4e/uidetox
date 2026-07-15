# Pattern: `shallow()`, `batch()`, `untracked()`

Escape hatches for when default deep-reactive `state()` becomes expensive.

## `state` vs `shallow`

`state(obj)` deep-proxies: every nested object is wrapped, every property read
tracks. Correct default. `shallow(obj)` tracks **only top-level keys** and
returns nested values untouched.

```ts
import { shallow, state } from 'ui-detox';

const g = shallow({ nodes: [], edges: [], aggregate: null });

effect(() => render(g.nodes.length));  // depends on the `nodes` slot
g.nodes = fresh;                        // ✅ re-runs
g.nodes.push(x);                        // ⚠️ no re-run — nested mutation isn't tracked
```

Use `shallow` for large, read-mostly payloads swapped wholesale (recompute
results, graph snapshots, search results). Need mutation-visibility on a nested
list? Wrap that list with `state()` and assign it into the slot.

The proxy identity is stable (`shallow(o) === shallow(o)`); nested values keep
their identity (`g.nodes === theArrayYouSet`). Delete notifies.

## `batch()`

Groups mutations so subscribers are notified once, after all writes finish.

```ts
import { batch } from 'ui-detox';

batch(() => {
  g.nodes = newNodes;
  g.edges = newEdges;
  g.aggregate = newAggregate;
});
// each subscriber re-runs at most once, only after all three writes
```

- Nested batches flatten — the outermost frame owns the flush.
- Reads inside see current (post-write) values.
- If the function throws, queued subscribers still flush (then the error
  propagates).

## `untracked()`

Read reactive state without subscribing the current effect — for logging/debug
reads that shouldn't create dependencies.

```ts
import { untracked } from 'ui-detox';

effect(() => {
  const size = g.nodes.length;                       // tracked
  log(untracked(() => JSON.stringify(g.edges)));      // not tracked
});
```

(`untrack` is the same function under its shorter name.)
