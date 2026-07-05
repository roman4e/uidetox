# island-cytoscape

A canvas-graph island — the copy-paste pattern for wrapping an imperative
library (Cytoscape.js, D3, Sigma, Monaco) in a UIDetox component.

`GraphEditor.ts` uses `defineComponent({ render: 'never', boot, onMount })`
directly (the form an island `.md`/`.dtx` compiles to) and demonstrates:

| Concern | Mechanism |
|---|---|
| Boot the library after connect | `onMount(ctx)` targeting `ctx.refs.root` |
| props → library | `ctx.effect(() => graph.setNodes(ctx.props.nodes))` |
| library → app | `ctx.emit('node:select', …)` (bubbling CustomEvent) |
| Palette drag&drop | `use="droppable"` / `installTraits` + `drop-payload` |
| Teardown | the cleanup returned from `onMount` (auto-run on unmount) |

Swap `makeGraph` for `cytoscape({ container })` and forward the real events.
See `docs/patterns/island-wrapper.md` for the lifecycle contract.
