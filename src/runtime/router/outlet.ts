import type { Handler, LazyHandler } from './types.js';
import type { MatchedRoute, RouterInstance } from './define.js';

let registered = false;

async function resolveHandler(handler: Handler): Promise<Exclude<Handler, LazyHandler>> {
  if (typeof handler === 'function') return handler;
  return handler.load();
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
      const fn = await resolveHandler(m.entry.handler);
      const node = await fn({ params: m.params, route: m.entry, location: m.location });
      while (this.firstChild) this.removeChild(this.firstChild);
      this.appendChild(node);
    }
  }
  customElements.define('router-outlet', RouterOutlet);
}
