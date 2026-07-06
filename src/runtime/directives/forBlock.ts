import type { TemplateCtx } from '../component.js';
import { effect } from '../effect.js';

const FRAGMENT_NODE = 11; // Node.DOCUMENT_FRAGMENT_NODE

interface Slot<T> {
  /** The real DOM nodes for this item (a multi-element body is a fragment). */
  nodes: Node[];
  /** The single node to insert/move (the fragment, or the one element). */
  mount: Node;
  item: T;
}

export interface ForHooks {
  onInsert?: (node: Node) => void;
  onRemove?: (node: Node, done: () => void) => void;
  onMove?: (node: Node) => void;
}

function firstNode<T>(slot: Slot<T>): Node | null {
  return slot.nodes[0] ?? null;
}

export function renderFor<T>(
  parent: Node,
  anchor: Node,
  source: () => T[],
  keyOf: (item: T, index: number) => unknown,
  bodyFactory: (item: T, index: number, ctx: TemplateCtx) => Node,
  ctx: TemplateCtx,
  hooks: ForHooks = {},
): void {
  const slots = new Map<unknown, Slot<T>>();
  let order: unknown[] = [];

  const removeSlot = (slot: Slot<T>): void => {
    const done = (): void => { for (const n of slot.nodes) n.parentNode?.removeChild(n); };
    if (hooks.onRemove) hooks.onRemove(firstNode(slot) ?? slot.mount, done);
    else done();
  };

  effect(() => {
    const list = source();
    const nextOrder = list.map((item, i) => keyOf(item, i));
    const nextSet = new Set(nextOrder);
    for (const key of order) {
      if (!nextSet.has(key)) {
        const slot = slots.get(key);
        if (slot) { slots.delete(key); removeSlot(slot); }
      }
    }
    let cursor: Node = anchor;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const key = nextOrder[i];
      let slot = slots.get(key);
      let inserted = false;
      if (!slot) {
        const mount = bodyFactory(item, i, ctx);
        const nodes = mount.nodeType === FRAGMENT_NODE ? Array.from(mount.childNodes) : [mount];
        slot = { nodes, mount, item };
        slots.set(key, slot);
        inserted = true;
      } else if (slot.item !== item) {
        slot.item = item;
      }
      const expectedNext = cursor.nextSibling;
      const first = firstNode(slot);
      if (first !== expectedNext) {
        // Insert/move the whole group before the expected position.
        for (const n of slot.nodes) parent.insertBefore(n, expectedNext);
        if (inserted) hooks.onInsert?.(first ?? slot.mount);
        else hooks.onMove?.(first ?? slot.mount);
      } else if (inserted) {
        hooks.onInsert?.(first ?? slot.mount);
      }
      cursor = slot.nodes[slot.nodes.length - 1] ?? cursor;
    }
    order = nextOrder;
  });
}
