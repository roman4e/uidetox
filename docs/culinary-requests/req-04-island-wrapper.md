# REQ-04 — Island Wrapper Contract (third-party libs inside a UIDetox component)

**Requested by:** Culinary frontend
**Priority:** P0 (DAG editor blocker — depends on Cytoscape.js)
**Estimated effort:** small (2-4 days — mostly documentation + a couple of lifecycle guarantees)

## Purpose

Define and document the guarantees UIDetox gives to a component that owns an imperative third-party library instance (Cytoscape.js, Monaco Editor, D3, mapping libs). Without these guarantees, the wrapper is fragile: leaks, missed cleanup, prop bridging bugs.

## Motivating use case from Culinary

**DAG graph editor** (`<GraphEditor>`) wraps a Cytoscape.js instance:
- Constructs the instance in `connectedCallback` targeting an inner `<div>`.
- Bridges reactive props (nodes list, edges list, selection) → imperative Cytoscape API.
- Bridges Cytoscape events (node click, edge click, position change) → `defineEmits`.
- Tears down cleanly on `disconnectedCallback` and when the host is moved in the DOM.

Same pattern will apply later to Monaco (recipe description WYSIWYG post-MVP) and possibly D3 (nutrient radar chart).

## What is (probably) already there

Custom Element base + `defineEmits` handles most of this. This request codifies edge cases the wrapper hits.

## Requested guarantees

### 1. Explicit `setup()` and `teardown()` hooks

Beyond `template` and `setup`, expose lifecycle hooks that fire deterministically:

```ts
defineComponent({
  tag: 'graph-editor',
  props: ['nodes', 'edges', 'selection'],
  template: (ctx) => __el('div', [['data-graph-root','static','']], [], ctx),
  onMount: (ctx) => {
    const root = ctx.host.querySelector('[data-graph-root]')!;
    const cy = cytoscape({ container: root, elements: toElements(ctx.props.nodes, ctx.props.edges) });
    ctx.emit('ready', cy);

    // Bridge props → cy
    ctx.effect(() => {
      cy.json({ elements: toElements(ctx.props.nodes, ctx.props.edges) });
    });
    ctx.effect(() => {
      cy.$(':selected').unselect();
      if (ctx.props.selection) cy.$id(ctx.props.selection).select();
    });

    // Bridge cy events → emits
    cy.on('tap', 'node', (e) => ctx.emit('node-tap', { id: e.target.id() }));
    cy.on('tap', 'edge', (e) => ctx.emit('edge-tap', { id: e.target.id() }));

    return () => cy.destroy();     // teardown returned from onMount
  },
});
```

Key requirements:
- **`onMount` runs after the template has produced DOM and the host is connected**, not before.
- **Cleanup returned from `onMount` is called on `disconnectedCallback`** and rerun on reconnection (or reused — decide, but must be documented).
- **`ctx.effect()` inside `onMount`** — an effect whose lifetime is tied to the component instance. Disposes on unmount. This is critical; today `effect(...)` inside `setup` may not be disposed automatically.

### 2. Element ref inside the shadow of the template

`ctx.host` is the custom element; but the wrapper needs a stable reference to the child container where the third-party lib mounts. Two options — pick one and document:

**Option A** — CSS selector querying `ctx.host`:

```ts
const root = ctx.host.querySelector('[data-graph-root]')!;
```

**Option B** — element ref (see phase 3f) captured in template:

```html
<div ref=${rootRef}></div>
```

Prefer Option B once phase 3f element refs land.

### 3. Prop bridging discipline

When a prop is a large object (e.g. `nodes` = 500 items), UIDetox should not re-mount the whole subtree on prop change. Only the `effect` reading that prop re-runs. This is already how signals work, but a wrapper contract note is needed: **never re-run `onMount` for a prop change, only for connected/disconnected**.

### 4. Emits with typed payloads

Already available via `defineEmits`. Document the pattern for imperative-lib events:

```ts
const emit = defineEmits<{
  'ready': cytoscape.Core;
  'node-tap': { id: string };
  'edge-tap': { id: string };
  'node-move': { id: string; x: number; y: number };
}>();
```

Consumer side:

```html
<GraphEditor
  nodes=${graph.nodes}
  edges=${graph.edges}
  selection=${sel.id}
  @ready=${(e) => cyRef.value = e.detail}
  @node-tap=${(e) => (sel.id = e.detail.id)}/>
```

### 5. Host element not being moved silently

If UIDetox moves a custom element within the DOM (e.g. via `<if>` toggle), it calls `disconnectedCallback` then `connectedCallback`. Cytoscape and similar libs expect their container to remain the same node. Document one of:
- **Guarantee:** UIDetox never moves a Custom Element across parents without a disconnect/reconnect cycle. Wrapper's teardown+setup handles it.
- **Alternative:** provide a `keepAlive` option that hoists the CE out of the flow and re-parents without disconnect. Not needed for MVP but note as future work.

MVP: guarantee is enough. Document.

### 6. SSR / hydrate opt-out

Island components should be marked `hydrate: eager` and `render: never` (or equivalent) in frontmatter so SSR does not attempt to serialize a Cytoscape canvas.

```yaml
render:
  static: never
  hydrate: eager
```

Document that pattern; verify SSR pipeline skips these components.

### 7. Access to registry inside `onMount`

`onMount` receives `ctx` — must expose `ctx.registry` (or `registry.get(...)` importable) so the wrapper can pull `apiToken`, `themeToken`, etc.

## Acceptance criteria

- [ ] `onMount(ctx) => cleanup?` lifecycle documented and implemented.
- [ ] `ctx.effect()` disposes on unmount.
- [ ] Consumer-facing docs page: `docs/patterns/island-wrapper.md` with the Cytoscape example (or a smaller `<canvas-clock>` demo if licensing prevents shipping Cytoscape).
- [ ] Example: `examples/island/` with a working wrapper (choose a public-domain lib).
- [ ] Test proving effect disposal: mount → trigger effect run → unmount → mutate state → assert effect did NOT run.
- [ ] SSR pipeline skips components with `render: { static: 'never' }` and injects placeholder markup only.

## Open questions

1. Is `onMount` a new API or an alias for existing `setup` + a returned cleanup? Alias is fine as long as cleanup semantics are guaranteed.
2. Does `ctx.effect` already exist under a different name? If yes, name it consistently.
