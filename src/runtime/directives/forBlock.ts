import type { TemplateCtx } from '../component.js';
import { effect } from '../effect.js';

interface Slot<T> {
  node: Node;
  item: T;
}

export interface ForHooks {
  onInsert?: (node: Node) => void;
  onRemove?: (node: Node, done: () => void) => void;
  onMove?: (node: Node) => void;
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

  effect(() => {
    const list = source();
    const nextOrder = list.map((item, i) => keyOf(item, i));
    const nextSet = new Set(nextOrder);
    for (const key of order) {
      if (!nextSet.has(key)) {
        const slot = slots.get(key);
        if (slot) {
          slots.delete(key);
          if (hooks.onRemove) {
            hooks.onRemove(slot.node, () => slot.node.parentNode?.removeChild(slot.node));
          } else {
            slot.node.parentNode?.removeChild(slot.node);
          }
        }
      }
    }
    let cursor: Node = anchor;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const key = nextOrder[i];
      let slot = slots.get(key);
      let inserted = false;
      if (!slot) {
        slot = { node: bodyFactory(item, i, ctx), item };
        slots.set(key, slot);
        inserted = true;
      } else if (slot.item !== item) {
        slot.item = item;
      }
      const expectedNext = cursor.nextSibling;
      if (slot.node !== expectedNext) {
        parent.insertBefore(slot.node, expectedNext);
        if (inserted) hooks.onInsert?.(slot.node);
        else hooks.onMove?.(slot.node);
      } else if (inserted) {
        hooks.onInsert?.(slot.node);
      }
      cursor = slot.node;
    }
    order = nextOrder;
  });
}
