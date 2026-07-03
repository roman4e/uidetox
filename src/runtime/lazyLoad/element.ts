import { createLoaderCache, type LoaderCache } from './loader.js';
import { attachTrigger, schedulePrefetch, type TriggerName } from './triggers.js';

let currentImporter: ((url: string) => Promise<unknown>) | undefined;
let sharedCache: LoaderCache | null = null;

function getCache(): LoaderCache {
  if (!sharedCache) {
    sharedCache = createLoaderCache((url) => (currentImporter ?? ((u) => import(/* @vite-ignore */ u)))(url));
  }
  return sharedCache;
}

function makePlaceholder(value: string | null): Node {
  if (!value) return document.createDocumentFragment();
  if (value === 'skeleton') {
    if (typeof customElements !== 'undefined' && customElements.get('uidetox-skeleton')) {
      return document.createElement('uidetox-skeleton');
    }
    const div = document.createElement('div');
    div.className = 'uidetox-skeleton';
    return div;
  }
  return document.createElement(value);
}

interface LoadedModule {
  __tag?: string;
  default?: unknown;
}

function instantiate(mod: LoadedModule): Node {
  if (mod.__tag) return document.createElement(mod.__tag);
  const factory = mod.default;
  if (typeof factory === 'function') {
    const result = (factory as (ctx: unknown) => Node)({});
    return result;
  }
  const fallback = document.createElement('div');
  fallback.textContent = '(empty lazy chunk)';
  return fallback;
}

export function registerLazyLoad(opts: { importer?: (url: string) => Promise<unknown> } = {}): void {
  if (opts.importer) {
    currentImporter = opts.importer;
    sharedCache = null;
  }

  if (customElements.get('lazy-load')) return;

  class LazyLoad extends HTMLElement {
    private handle: ReturnType<typeof attachTrigger> | null = null;
    private mounted = false;

    connectedCallback(): void {
      if (this.mounted) return;
      this.mounted = true;

      const src = this.getAttribute('src');
      if (!src) return;
      const trigger = (this.getAttribute('trigger') ?? 'visible') as TriggerName;
      const placeholderAttr = this.getAttribute('placeholder');
      const prefetch = this.hasAttribute('prefetch');

      const placeholderNode = makePlaceholder(placeholderAttr);
      if (placeholderNode) this.appendChild(placeholderNode);

      if (prefetch) schedulePrefetch(() => { void getCache().load(src); });

      const fire = () => { void this.doLoad(src); };
      this.handle = attachTrigger(trigger, this, fire);
      this.handle.start();
    }

    disconnectedCallback(): void {
      this.handle?.stop();
      this.handle = null;
    }

    async doLoad(src: string): Promise<void> {
      try {
        const mod = (await getCache().load(src)) as LoadedModule;
        while (this.firstChild) this.removeChild(this.firstChild);
        this.appendChild(instantiate(mod));
        this.dispatchEvent(new CustomEvent('load'));
      } catch (err) {
        this.dispatchEvent(new CustomEvent('error', { detail: err }));
      }
    }

    load(): void {
      const src = this.getAttribute('src');
      if (!src) return;
      void this.doLoad(src);
    }
  }

  customElements.define('lazy-load', LazyLoad);
}
