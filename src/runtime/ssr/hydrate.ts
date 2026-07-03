/**
 * Walks the existing DOM under `root` and forces every registered Custom
 * Element to be upgraded (which fires connectedCallback → component boot).
 * Reactive bindings then attach to already-rendered text/element nodes
 * without re-rendering.
 */
export function hydrate(root: Element): void {
  if (typeof customElements === 'undefined') return;
  const walk = (el: Element) => {
    if (el.tagName.includes('-')) {
      customElements.upgrade(el);
    }
    for (const child of Array.from(el.children)) walk(child);
  };
  walk(root);
}
