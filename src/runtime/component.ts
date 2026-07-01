import { state } from './state.js';

export interface TemplateCtx {
  props: Record<string, unknown>;
  host: HTMLElement;
}

export interface ComponentOptions {
  tag: string;
  template: (ctx: TemplateCtx) => Node;
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
      const ctx: TemplateCtx = { props: this._props, host: this };
      Object.assign(this._props, options.setup?.(ctx) ?? {});
      const node = options.template(ctx);
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
