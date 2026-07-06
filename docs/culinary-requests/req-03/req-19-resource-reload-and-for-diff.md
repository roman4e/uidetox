# REQ-19 — `resource.reload()` doesn't invalidate + `<for>` DOM diff appends stale items

**Priority:** **P0** — every list screen that mutates and then refetches
via `resource.reload()` is broken: stale rows stay in the DOM and new
rows pile up on top of them, or fresh data never replaces old.
**Follows:** REQ-13..18. Editor + basic CRUD work. Data invalidation and
list re-render are broken.

## Symptom A — Culinary Archive page

`src/pages/Archive.dtx`:

```
const list = resource(
  (signal) => api.value.dishes.listEndpoint({ query: { q: q.text, archived: true }, signal }),
  { key: () => JSON.stringify(q) }
);

async function unarchive(id, ev) {
  ev.stopPropagation();
  await api.value.dishes.unarchiveEndpoint({ path: { dish_id: id } });
  list.reload();
}
```

Server before: 1 archived dish. After `unarchive`: server has 0 archived
(verified by direct `fetch('/api/v1/dishes/?archived=true')`). But the
archive page's `<for each=${list.data.items} …>` renders **3 rows** (the
count actually GROWS across successive tests instead of dropping to 0).

## Symptom B — Culinary RecipeEditor inspector

`src/pages/RecipeEditor.dtx` inspector uses:

```
<if when=${sel.nodeKey}>
  <h3>Вузол</h3>
  <for each=${ed.nodes.filter(x => x.node_key === sel.nodeKey)} item="node" key="node.node_key">
    <label>… input for node.label …</label>
    <label>… input for node.mass_bruto_g …</label>
    …
  </for>
</if>
```

Selecting a node repeatedly (tap a node, background, tap same node, etc.)
appends **another copy of the inspector fields** each time — the previous
fields stay in the DOM. Deselecting doesn't remove them. Effectively the
inspector grows without bound.

Same pattern on the edge inspector `<for each=${[ed.edges[sel.edgeIdx]].filter(Boolean)} …>`.

## Symptom C — `<if when=${derived.value}>` also appends on transition (added after Culinary's second attempt)

Culinary tried to work around Symptom B by replacing
`<for each=${arr.filter(...)}>` with `<if when=${derived.value}>` +
inline expressions:

```
const selectedNode = derived(() => ed.nodes.find(n => n.node_key === sel.nodeKey) ?? null);
```

```html
<if when=${selectedNode.value}>
  <h3>Вузол</h3>
  <label><span>Назва</span><input …/></label>
  <label><span>Інгредієнт</span><select …/></label>
  <label><span>Маса брутто</span><input …/></label>
  <label><span>Маса нетто</span><input …/></label>
  <div class="ins-actions">…</div>
</if>
```

Live observation: every time `selectedNode.value` transitions from a node
→ null → same node, the entire inspector subtree is **appended again**.
Screenshot below shows the inspector accumulated 5 copies of `<h3>Вузол</h3>`
+ 5 copies of `Назва` + name field + `Зробити фінальним` / `Видалити` buttons
after 5 select/deselect cycles. Only the trailing "Оберіть вузол/ребро на графі"
paragraphs stack at the bottom (also duplicated).

So the bug is not specific to `<for>` — the `<if>` conditional branch DOM
mount/unmount is broken too. When `when` goes true → false → true, the
false-transition doesn't remove the previously mounted branch; the next
true-transition mounts a fresh copy alongside it.

## Root cause hypotheses (both plausible; one may cause the other)

### 19a — `resource.reload()` doesn't invalidate the current data

Reading REFERENCE §18: `resource(fetcher, {key})` re-runs when `key`
changes. `reload()` should force a fresh run of the fetcher. In Culinary
tests, `reload()` was called but `list.data.items` continued to reference
the previous array. Either:

- `reload()` no-ops when `key` string is unchanged, OR
- `reload()` triggers a fetch but the result is merged/appended into the
  existing `.data.items` instead of replacing it, OR
- the reactive `data` slot is not being updated on the fetcher's fresh
  return (subscribers see old value).

**Expected:** `reload()` unconditionally re-fires the fetcher (bypassing
`key` cache), awaits, and swaps `.data` to the new response. Subscribers
are notified once.

**Regression test suggestion:**

```ts
const r = resource(async () => currentCount++, { key: () => 'k' });
await r.wait();
expect(r.data).toBe(0);
r.reload();
await r.wait();
expect(r.data).toBe(1);
```

### 19b — `<for each>` DOM diff appends new items instead of replacing when the source array is a new reference

When `ed.nodes.filter(...)` returns a fresh array on every render (even
if length is 0 or 1), `<for>` seems to APPEND per-render output on top of
previous output. The `key="node.node_key"` doesn't help because the diff
apparently doesn't remove nodes whose keys are missing from the new
array.

**Expected `<for>` behavior:**

- Old keys not in the new array → their DOM subtrees are removed.
- New keys not in the old array → mounted.
- Shared keys → DOM identity preserved.

**Regression test suggestion:**

```ts
// Mount <for each=${state.items} item="x" key="x.id"><span>${x.name}</span></for>
state.items = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];
// DOM: <span>a</span><span>b</span>
state.items = [{ id: 3, name: 'c' }];
// Expected DOM: <span>c</span>  (b and a removed)
// Observed in Culinary: <span>a</span><span>b</span><span>c</span>  (a, b remain)
```

## What the Culinary side did (temporary, must be undone)

Two `location.reload()` shims after archive/unarchive/delete. This is a
hard page reload — destroys any client state, disables SPA transitions,
smells terrible. Documented in the memory `no-framework-hacks` as
forbidden going forward.

Culinary side has already reverted these shims and is waiting on
REQ-19 to land before shipping list-mutating UIs. Any list page that
mutates + refetches is currently broken until this REQ closes.

## Acceptance criteria

- [ ] `resource(fetcher, {key}).reload()` unconditionally re-runs the
      fetcher and replaces `.data` on success. Subscribers re-render once.
- [ ] `<for each= key= item=>` keyed diff: old keys not in new array →
      DOM removed. Shared keys → DOM preserved. New keys → mounted. No
      stale nodes remain.
- [ ] `<if when=${cond}>` teardown on `cond` → falsy: previously mounted
      DOM (including nested `<label>`, `<div>`, etc.) is removed from the
      parent element, cleanup functions of any effects inside are called.
- [ ] Regression tests as above + one for `<if>` mount/unmount:

  ```ts
  // Mount <if when=${state.show}><span>{state.text}</span></if>
  state.show = true; state.text = 'a';
  // DOM has one <span>a</span>
  state.show = false;
  // DOM has zero <span>
  state.show = true;
  // DOM has one <span>a</span>, not two, not zero.
  ```

## Verification recipe

```bash
cd ~/Work/My/Culinary/culinary-frontend
pnpm build
# deploy to prod
# Login, archive a dish → dish disappears from dashboard immediately (no reload).
# Go to /archive → click Unarchive → row disappears immediately.
# On editor, tap a node → inspector shows once. Tap background → inspector clears. Tap another node → inspector shows fresh single copy.
```

## After this lands

Culinary side will:
- Drop `location.reload()` after archive/unarchive/delete.
- Rely on `list.reload()` for invalidation.
- Test node/edge inspector — expect single copy, correct removal.
