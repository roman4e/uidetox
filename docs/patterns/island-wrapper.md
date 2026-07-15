# Pattern: Island Wrapper (third-party imperative libraries)

Wrap an imperative library instance (Cytoscape.js, Monaco, D3, mapping libs)
inside a UIDetox component with deterministic lifecycle and clean teardown.

## Lifecycle contract

| Hook | When |
|---|---|
| `boot(ctx)` | builds the template DOM; `ctx.refs` populated here |
| `onMount(ctx)` | after the DOM is built **and** the host is connected |
| cleanup returned from `onMount` | on `disconnectedCallback` |
| `ctx.effect(fn)` | instance-scoped; **disposed automatically on unmount** |

Guarantees:

- `onMount` runs **once per connection**, never for a prop change — only
  connect/disconnect. Prop changes re-run the `ctx.effect`s that read them.
- `ctx.effect(...)` created in `boot` or `onMount` are disposed on disconnect —
  no leaks.
- UIDetox does not move a Custom Element across parents without a
  disconnect/reconnect cycle; the wrapper's teardown + setup handles it.
- SSR: mark the component `render: never` — its `boot`/`onMount` do not run
  during `renderToString`; a placeholder comment is emitted instead.

## Context surface for wrappers

```ts
ctx.host                 // the custom element
ctx.refs.<name>          // template element refs (e.g. the mount container)
ctx.find(sel)            // querySelector within the host
ctx.effect(fn)           // reactive effect, auto-disposed on unmount
ctx.emit(name, detail)   // bubbling composed CustomEvent
ctx.registry             // hierarchical registry (apiToken, themeToken, …)
```

## Cytoscape example

```ts
import cytoscape from 'cytoscape';
import { defineComponent } from 'ui-detox';

defineComponent({
  tag: 'graph-editor',
  props: ['nodes', 'edges', 'selection'],
  render: 'never',
  boot: (ctx) => {
    const root = document.createElement('div');
    ctx.refs.graphRoot = root;
    return root;
  },
  onMount: (ctx) => {
    const cy = cytoscape({
      container: ctx.refs.graphRoot as HTMLElement,
      elements: toElements(ctx.props.nodes, ctx.props.edges),
    });
    ctx.emit('ready', cy);

    // Bridge props → cy (each effect disposes on unmount)
    ctx.effect(() => cy.json({ elements: toElements(ctx.props.nodes, ctx.props.edges) }));
    ctx.effect(() => {
      cy.$(':selected').unselect();
      if (ctx.props.selection) cy.$id(String(ctx.props.selection)).select();
    });

    // Bridge cy events → emits
    cy.on('tap', 'node', (e) => ctx.emit('node-tap', { id: e.target.id() }));
    cy.on('tap', 'edge', (e) => ctx.emit('edge-tap', { id: e.target.id() }));

    return () => cy.destroy(); // teardown on disconnect
  },
});
```

Consumer:

```html
<graph-editor
  nodes=${graph.nodes}
  edges=${graph.edges}
  selection=${sel.id}
  @ready=${(e) => (cyRef.value = e.detail)}
  @node-tap=${(e) => (sel.id = e.detail.id)}/>
```

A runnable, dependency-free version lives in `examples/island/`
(`canvas-clock.ts` + `CanvasClock.md`) — a `<canvas>` animation with the same
`onMount → requestAnimationFrame → cancel on cleanup` shape.
