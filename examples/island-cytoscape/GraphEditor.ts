// Canvas-graph island (the pattern used to wrap Cytoscape.js / D3 / Sigma).
//
// Demonstrates the full island contract:
//   - onMount boots the imperative library targeting a template ref,
//   - ctx.effect bridges reactive props (`nodes`) into the library,
//   - ctx.emit bridges library events back out (`node:select`),
//   - use="droppable" accepts palette drag&drop (see registerDnd),
//   - the cleanup returned from onMount tears the library down on unmount.
//
// A real app imports `cytoscape`; here `makeGraph` is a tiny self-contained stub
// so the example has no external dependency.
import { defineComponent, registerDnd, installTraits } from 'uidetox';

interface GraphNode { id: string; label: string; x: number; y: number }

interface GraphInstance {
  setNodes(nodes: GraphNode[]): void;
  on(event: 'select', cb: (id: string) => void): void;
  destroy(): void;
}

// Stand-in for `cytoscape({ container })`. Replace with the real lib.
function makeGraph(container: HTMLElement): GraphInstance {
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  let selectHandler: ((id: string) => void) | null = null;
  let nodes: GraphNode[] = [];
  const onClick = () => { if (nodes[0] && selectHandler) selectHandler(nodes[0].id); };
  canvas.addEventListener('click', onClick);
  return {
    setNodes(next) { nodes = next; /* real lib would repaint here */ },
    on(_e, cb) { selectHandler = cb; },
    destroy() { canvas.removeEventListener('click', onClick); canvas.remove(); },
  };
}

registerDnd();

defineComponent({
  tag: 'graph-editor',
  // SSR opt-out: the canvas library only runs on the client.
  render: 'never',
  boot: (ctx) => {
    const root = document.createElement('div');
    root.className = 'graph-root';
    root.style.width = '100%';
    root.style.height = '100%';
    ctx.refs.root = root;
    return root;
  },
  onMount: (ctx) => {
    const graph = makeGraph(ctx.refs.root as HTMLElement);

    // props → library: repaint whenever `nodes` changes.
    ctx.effect(() => {
      graph.setNodes((ctx.props.nodes as GraphNode[]) ?? []);
    });

    // library → app: forward selection as a DOM CustomEvent.
    graph.on('select', (id) => ctx.emit('node:select', { id }));

    // palette drag&drop: create a node at the drop coordinates.
    const disposeTraits = installTraits(ctx.host, new Map([[
      ctx.host,
      [{ traitName: 'droppable', params: { accept: 'ingredient' } }],
    ]]));
    const onDrop = (e: Event) => {
      const { payload, offsetX, offsetY } = (e as CustomEvent).detail;
      ctx.emit('node:add', { payload, x: offsetX, y: offsetY });
    };
    ctx.host.addEventListener('drop-payload', onDrop);

    return () => {
      graph.destroy();
      disposeTraits();
      ctx.host.removeEventListener('drop-payload', onDrop);
    };
  },
});
