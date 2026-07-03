import { setCurrentHost } from './emits.js';
import { state } from './state.js';

export interface TemplateCtx {
  props: Record<string, unknown>;
  host: HTMLElement;
  refs: Record<string, Element>;
  ref: (name: string) => Element | undefined;
  find: (selector: string) => Element | null;
  findAll: (selector: string) => Element[];
}

export interface ComponentOptions {
  tag: string;
  boot?: (ctx: TemplateCtx) => Node;
  /**
   * Back-compat entry points still used by direct-consumer tests.
   * `template` fires after `setup`; when `boot` is provided it takes
   * precedence and `setup`/`template` are ignored.
   */
  template?: (ctx: TemplateCtx) => Node;
  setup?: (ctx: TemplateCtx) => Record<string, unknown> | void;
  style?: string;
  props?: string[];
}

export function defineComponent(options: ComponentOptions): void {
  const observedAttrs = options.props ?? [];

  class UiElement extends HTMLElement {
    static get observedAttributes(): string[] {
      return observedAttrs;
    }
    private _props = state<Record<string, unknown>>({});
    private _mounted = false;

    connectedCallback(): void {
      if (this._mounted) return;
      this._mounted = true;
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
      };
      let node: Node;
      setCurrentHost(this);
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
      }
      this.appendChild(node);
      if (options.style) {
        const styleEl = document.createElement('style');
        styleEl.textContent = options.style;
        this.appendChild(styleEl);
      }
    }

    attributeChangedCallback(name: string, _prev: string | null, next: string | null): void {
      this._props[name] = next;
    }
  }

  customElements.define(options.tag, UiElement);
}
