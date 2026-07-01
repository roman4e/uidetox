import type { TemplateCtx } from '../component.js';
import { effect } from '../effect.js';

interface Slot<T> {
  node: Node;
  item: T;
}

export function renderFor<T>(
  parent: Node,
  anchor: Node,
  source: () => T[],
  keyOf: (item: T, index: number) => unknown,
  bodyFactory: (item: T, index: number, ctx: TemplateCtx) => Node,
  ctx: TemplateCtx,
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
        slot?.node.parentNode?.removeChild(slot.node);
        slots.delete(key);
      }
    }
    let cursor: Node = anchor;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const key = nextOrder[i];
      let slot = slots.get(key);
      if (!slot) {
        slot = { node: bodyFactory(item, i, ctx), item };
        slots.set(key, slot);
      } else if (slot.item !== item) {
        slot.item = item;
      }
      const expectedNext = cursor.nextSibling;
      if (slot.node !== expectedNext) {
        parent.insertBefore(slot.node, expectedNext);
      }
      cursor = slot.node;
    }
    order = nextOrder;
  });
}
