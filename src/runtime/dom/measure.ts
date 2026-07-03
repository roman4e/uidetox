import { commitStage } from './stage.js';

/**
 * Reads layout geometry. Commits any pending staged mutations first so the
 * measurement reflects the latest logical state, then runs `fn`. Forces at
 * most one synchronous layout; the browser does not paint until its frame.
 */
export function measure<T>(fn: () => T): T {
  commitStage();
  return fn();
}

/**
 * Measures a hypothetical node without ever showing it. Appends the built node
 * to an offscreen, visually-hidden container (fully laid out and therefore
 * measurable), runs `read`, then removes the container.
 */
export function measureOffscreen<T>(build: () => Node, read: (el: Element) => T): T {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.visibility = 'hidden';
  container.style.pointerEvents = 'none';
  const node = build();
  container.appendChild(node);
  document.body.appendChild(container);
  try {
    const el = (node.nodeType === 1 ? node : container) as Element;
    return read(el);
  } finally {
    container.remove();
  }
}
