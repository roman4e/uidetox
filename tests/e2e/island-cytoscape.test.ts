import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../src/runtime/component.js';
import { registerDnd } from '../../src/runtime/dnd/register.js';
import { installTraits } from '../../src/runtime/traits/install.js';
import { emitDrag } from '../../src/runtime/dnd/bus.js';
import { state } from '../../src/runtime/state.js';
import { flushSync } from '../../src/runtime/scheduler.js';

// Mirrors examples/island-cytoscape/GraphEditor.ts — proves the island contract.
interface GNode { id: string }
function makeGraph(container: HTMLElement) {
  const c = document.createElement('canvas');
  container.appendChild(c);
  let nodes: GNode[] = [];
  return {
    painted: () => nodes,
    setNodes(n: GNode[]) { nodes = n; },
    destroy() { c.remove(); },
  };
}

describe('canvas-graph island (§11.8)', () => {
  it('bridges props → lib, emits, accepts drop, and tears down', () => {
    registerDnd();
    const props = state<{ nodes: GNode[] }>({ nodes: [] });
    let graph: ReturnType<typeof makeGraph> | null = null;
    let destroyed = false;
    const emits: Array<{ name: string; detail: unknown }> = [];

    defineComponent({
      tag: 'graph-editor-t',
      render: 'never',
      boot: (ctx) => {
        const root = document.createElement('div');
        ctx.refs.root = root;
        // bridge our external `props` store into ctx for the test
        (ctx.props as Record<string, unknown>).nodes = props.nodes;
        return root;
      },
      onMount: (ctx) => {
        graph = makeGraph(ctx.refs.root as HTMLElement);
        ctx.effect(() => { graph!.setNodes(props.nodes); });        // props → lib
        const disposeTraits = installTraits(ctx.host, new Map([[ctx.host, [{ traitName: 'droppable', params: { accept: 'ingredient' } }]]]));
        const onDrop = (e: Event) => { const d = (e as CustomEvent).detail; ctx.emit('node:add', d); };
        ctx.host.addEventListener('drop-payload', onDrop);
        return () => { graph!.destroy(); destroyed = true; disposeTraits(); ctx.host.removeEventListener('drop-payload', onDrop); };
      },
    });

    const el = document.createElement('graph-editor-t');
    el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, x: 0, y: 0, toJSON() {} }) as DOMRect;
    el.addEventListener('node:add', (e) => emits.push({ name: 'node:add', detail: (e as CustomEvent).detail }));
    document.body.appendChild(el);

    // props → lib bridge
    props.nodes = [{ id: 'a' }, { id: 'b' }];
    flushSync();
    expect(graph!.painted()).toHaveLength(2);

    // drag&drop from a palette → emit node:add with coordinates
    emitDrag('drag:move', { payload: { kind: 'ingredient', id: 7 }, clientX: 50, clientY: 60, source: document.body });
    emitDrag('drag:end', { payload: { kind: 'ingredient', id: 7 }, clientX: 50, clientY: 60, source: document.body });
    expect(emits).toHaveLength(1);
    expect(emits[0].detail).toMatchObject({ offsetX: 50, offsetY: 60 });

    // teardown on unmount
    el.remove();
    expect(destroyed).toBe(true);
  });
});
