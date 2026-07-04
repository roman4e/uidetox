import { setCurrentHost } from './emits.js';
import { setCleanupSink } from './lifecycle.js';
import { effect } from './effect.js';
import { registry } from './registry.js';
import { state } from './state.js';
import { task, type TaskOptions } from './task.js';

export interface TemplateCtx {
  props: Record<string, unknown>;
  host: HTMLElement;
  refs: Record<string, Element>;
  ref: (name: string) => Element | undefined;
  find: (selector: string) => Element | null;
  findAll: (selector: string) => Element[];
  /** Instance-scoped effect — auto-disposed on disconnect. */
  effect: (fn: () => void | (() => void)) => () => void;
  /** Detached async reactive task — auto-disposed on disconnect. */
  task: (fn: (signal: AbortSignal) => void | Promise<void>, opts?: TaskOptions) => () => void;
  /** Dispatch a bubbling composed CustomEvent from the host. */
  emit: (name: string, detail?: unknown) => void;
  /** The global hierarchical Registry. */
  registry: typeof registry;
}

export interface ComponentOptions {
  tag: string;
  boot?: (ctx: TemplateCtx) => Node;
  /** Fires after the template DOM is built and the host is connected. May return a cleanup. */
  onMount?: (ctx: TemplateCtx) => void | (() => void);
  template?: (ctx: TemplateCtx) => Node;
  setup?: (ctx: TemplateCtx) => Record<string, unknown> | void;
  style?: string;
  props?: string[];
  /** SSR behaviour. 'never' → skip boot during SSR, emit placeholder only. */
  render?: 'always' | 'whenPropsKnown' | 'never';
}

let ssrMode = false;
/** Toggle SSR mode (renderToString sets this around a render). */
export function setSsrMode(on: boolean): void {
  ssrMode = on;
}

export function defineComponent(options: ComponentOptions): void {
  const observedAttrs = options.props ?? [];

  class UiElement extends HTMLElement {
    static get observedAttributes(): string[] {
      return observedAttrs;
    }
    private _props = state<Record<string, unknown>>({});
    private _mounted = false;
    private _disposers: Array<() => void> = [];
    private _mountCleanup: (() => void) | undefined;

    connectedCallback(): void {
      if (this._mounted) return;
      this._mounted = true;

      // SSR opt-out: render:never components emit a placeholder, no boot.
      if (ssrMode && options.render === 'never') {
        this.appendChild(document.createComment('uidetox:island'));
        return;
      }

      for (const name of observedAttrs) {
        if (this.hasAttribute(name)) {
          this._props[name] = this.getAttribute(name);
        }
      }
      const refs: Record<string, Element> = {};
      const ctx: TemplateCtx = {
        props: this._props,
        host: this,
        refs,
        ref: (name) => refs[name],
        find: (selector) => this.querySelector(selector),
        findAll: (selector) => Array.from(this.querySelectorAll(selector)),
        effect: (fn) => {
          const dispose = effect(fn);
          this._disposers.push(dispose);
          return dispose;
        },
        task: (fn, opts) => {
          const dispose = task(fn, opts);
          this._disposers.push(dispose);
          return dispose;
        },
        emit: (name, detail) => {
          this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
        },
        registry,
      };
      let node: Node;
      setCurrentHost(this);
      setCleanupSink(this._disposers);
      try {
        if (options.boot) {
          node = options.boot(ctx);
        } else if (options.template) {
          Object.assign(this._props, options.setup?.(ctx) ?? {});
          node = options.template(ctx);
        } else {
          throw new Error('Component must define either boot() or template()');
        }
      } finally {
        setCurrentHost(null);
        setCleanupSink(null);
      }
      this.appendChild(node);
      if (options.style) {
        const styleEl = document.createElement('style');
        styleEl.textContent = options.style;
        this.appendChild(styleEl);
      }
      // onMount runs after DOM is built and connected.
      if (options.onMount) {
        const cleanup = options.onMount(ctx);
        if (typeof cleanup === 'function') this._mountCleanup = cleanup;
      }
    }

    disconnectedCallback(): void {
      for (const d of this._disposers) d();
      this._disposers = [];
      this._mountCleanup?.();
      this._mountCleanup = undefined;
      this._mounted = false;
      while (this.firstChild) this.removeChild(this.firstChild);
    }

    attributeChangedCallback(name: string, _prev: string | null, next: string | null): void {
      this._props[name] = next;
    }
  }

  customElements.define(options.tag, UiElement);
}
