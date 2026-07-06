import type { Handler, LazyHandler } from './types.js';
import type { MatchedRoute, RouterInstance } from './define.js';

let registered = false;

async function resolveHandler(handler: Handler): Promise<Exclude<Handler, LazyHandler>> {
  if (typeof handler === 'function') return handler;
  // A lazy handler may resolve to another lazy handler — unwrap recursively.
  return resolveHandler(await handler.load());
}

export function registerOutlet(): void {
  if (registered) return;
  registered = true;
  class RouterOutlet extends HTMLElement {
    private router: RouterInstance | null = null;
    private unsub: (() => void) | null = null;

    __attach(router: RouterInstance): void {
      this.router = router;
      this.unsub = router.onMatched((m) => {
        void this.render(m);
      });
    }

    disconnectedCallback(): void {
      this.unsub?.();
      this.unsub = null;
      this.router = null;
    }

    private async render(m: MatchedRoute): Promise<void> {
      const ctx = { params: m.params, route: m.entry, location: m.location };
      const fn = await resolveHandler(m.entry.handler);
      const pageNode = await fn(ctx);

      // Wrap the page in its layout (from `meta.layout`); the layout's default
      // <slot/> projects the page. One level for MVP (REQ-17).
      const layout = m.entry.meta?.layout as Handler | undefined;
      let node: Node = pageNode;
      if (layout) {
        const layoutFn = await resolveHandler(layout);
        const layoutNode = await layoutFn(ctx);
        layoutNode.appendChild(pageNode);
        node = layoutNode;
      }

      while (this.firstChild) this.removeChild(this.firstChild);
      this.appendChild(node);
    }
  }
  customElements.define('router-outlet', RouterOutlet);
}
