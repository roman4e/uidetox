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
  /** Register teardown to run when this component disconnects (REQ-27). */
  onCleanup: (fn: () => void) => void;
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
    /** Authored light-DOM (slotted) content, restored on disconnect so a move re-projects it. */
    private _slotted: ChildNode[] = [];

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
      // Route params set by a route handler — typed (coerced by paramsSchema),
      // so they overwrite the string attribute values (REQ-18).
      const routeParams = (this as unknown as { __uidetoxParams?: Record<string, unknown> }).__uidetoxParams;
      if (routeParams) Object.assign(this._props, routeParams);
      // Capture light-DOM children present at connect — these are the slotted
      // content, projected into the template's <slot> after boot.
      const slotted: ChildNode[] = [];
      while (this.firstChild) { slotted.push(this.firstChild); this.removeChild(this.firstChild); }
      this._slotted = slotted;
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
        onCleanup: (fn) => { this._disposers.push(fn); },
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
      // Project slotted content into the template's <slot>s (light DOM). Children
      // with `slot="name"` go to the matching `<slot name="name">`, the rest to
      // the default `<slot>`. No slot → append at the end so content isn't lost.
      if (slotted.length) {
        const slots = new Map<string, Element>();
        for (const s of this.querySelectorAll('slot')) {
          slots.set(s.getAttribute('name') ?? '', s);
        }
        if (slots.size === 0) {
          for (const n of slotted) this.appendChild(n);
        } else {
          const defaultSlot = slots.get('');
          for (const n of slotted) {
            const name = n.nodeType === 1 ? ((n as Element).getAttribute('slot') ?? '') : '';
            const target = slots.get(name) ?? defaultSlot;
            if (target) target.parentNode?.insertBefore(n, target);
            else this.appendChild(n);
          }
          for (const s of slots.values()) s.remove();
        }
      }
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
      // Restore authored (slotted) content so a move/reconnect re-projects it
      // instead of re-booting empty (e.g. a kit component inside another's slot).
      for (const n of this._slotted) this.appendChild(n);
    }

    attributeChangedCallback(name: string, _prev: string | null, next: string | null): void {
      this._props[name] = next;
    }
  }

  customElements.define(options.tag, UiElement);
}
