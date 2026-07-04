import type { TemplateCtx } from '../component.js';
import { effect } from '../effect.js';
import { computeWindow } from './virtualWindow.js';

export interface VirtualForOptions {
  rowHeight: number;
  overscan?: number;
  /** 'self' (default) → the element itself scrolls; otherwise an ancestor selector. */
  scrollParent?: string;
  debug?: boolean;
  /** Test/override hook for scroll metrics. */
  metrics?: () => { scrollTop: number; viewportHeight: number };
}

export interface VirtualForElement extends HTMLElement {
  scrollToIndex(index: number): void;
  scrollToKey(key: unknown): void;
}

interface Slot {
  node: Node;
  key: unknown;
}

/**
 * Windowed keyed list. Renders only the visible slice (+ overscan) of `source`,
 * mounting/unmounting rows as the scroll position changes. Returns the scroll
 * container element (augmented with `scrollToIndex` / `scrollToKey`).
 */
export function renderVirtualFor<T>(
  source: () => T[],
  keyOf: (item: T, index: number) => unknown,
  bodyFactory: (item: T, index: number, ctx: TemplateCtx) => Node,
  ctx: TemplateCtx,
  opts: VirtualForOptions,
): VirtualForElement {
  const overscan = opts.overscan ?? 4;
  const selfScroll = !opts.scrollParent || opts.scrollParent === 'self';

  const container = document.createElement('div') as VirtualForElement;
  container.setAttribute('part', 'virtual-for');
  if (selfScroll) {
    container.style.overflow = 'auto';
    container.style.contain = 'strict';
  }

  const sizer = document.createElement('div');
  sizer.style.position = 'relative';
  sizer.style.width = '100%';
  const layer = document.createElement('div');
  layer.style.position = 'absolute';
  layer.style.top = '0';
  layer.style.left = '0';
  layer.style.right = '0';
  sizer.appendChild(layer);
  container.appendChild(sizer);

  const slots = new Map<unknown, Slot>();
  let currentList: T[] = [];

  const getScrollEl = (): HTMLElement => {
    if (selfScroll) return container;
    return (container.closest(opts.scrollParent!) as HTMLElement) ?? container;
  };

  const readMetrics = (): { scrollTop: number; viewportHeight: number } => {
    if (opts.metrics) return opts.metrics();
    const el = getScrollEl();
    let scrollTop = el.scrollTop;
    if (!selfScroll) {
      // Adjust for the container's offset inside the ancestor scroller so
      // row 0 aligns with the container top, not the scroller top.
      const offset = container.getBoundingClientRect().top - el.getBoundingClientRect().top;
      scrollTop = Math.max(0, el.scrollTop - offset);
    }
    return { scrollTop, viewportHeight: el.clientHeight };
  };

  function update(list: T[]): void {
    currentList = list;
    const { scrollTop, viewportHeight } = readMetrics();
    const win = computeWindow({
      scrollTop,
      viewportHeight,
      rowHeight: opts.rowHeight,
      count: list.length,
      overscan,
    });
    sizer.style.height = `${win.totalHeight}px`;
    layer.style.transform = `translateY(${win.offsetTop}px)`;
    if (opts.debug) {
      container.setAttribute('data-virtual-window', `${win.start},${win.end},${list.length}`);
    }

    const desiredKeys: unknown[] = [];
    for (let i = win.start; i < win.end; i++) desiredKeys.push(keyOf(list[i], i));
    const desiredSet = new Set(desiredKeys);

    for (const [key, slot] of slots) {
      if (!desiredSet.has(key)) {
        slot.node.parentNode?.removeChild(slot.node);
        slots.delete(key);
      }
    }

    let cursor: Node | null = null;
    for (let n = 0; n < desiredKeys.length; n++) {
      const i = win.start + n;
      const item = list[i];
      const key = desiredKeys[n];
      let slot = slots.get(key);
      if (!slot) {
        slot = { node: bodyFactory(item, i, ctx), key };
        slots.set(key, slot);
      }
      const expectedNext = cursor ? cursor.nextSibling : layer.firstChild;
      if (slot.node !== expectedNext) {
        layer.insertBefore(slot.node, expectedNext);
      }
      cursor = slot.node;
    }
  }

  // Re-run when the source array (identity/length/items) changes.
  effect(() => {
    const list = source();
    update(list);
  });

  // Re-window on scroll.
  const onScroll = (): void => update(currentList);
  getScrollElListen(getScrollEl(), onScroll);

  container.scrollToIndex = (index: number): void => {
    const el = getScrollEl();
    el.scrollTop = Math.max(0, index) * opts.rowHeight;
    update(currentList);
  };
  container.scrollToKey = (key: unknown): void => {
    const idx = currentList.findIndex((item, i) => keyOf(item, i) === key);
    if (idx >= 0) container.scrollToIndex(idx);
  };

  return container;
}

function getScrollElListen(el: HTMLElement, handler: () => void): void {
  el.addEventListener('scroll', handler, { passive: true });
}
