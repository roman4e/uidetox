export interface SsrOptions {
  attrs?: Record<string, string>;
  childrenHTML?: string;
}

/**
 * Renders a Custom Element and its subtree to a serialised HTML string.
 * Assumes `defineComponent` has been called for the tag before this runs (i.e.
 * component modules are imported into the same process before calling this).
 */
export function renderToString(tag: string, opts: SsrOptions = {}): string {
  if (typeof document === 'undefined') {
    throw new Error('renderToString requires a DOM environment (call from happy-dom / jsdom / browser).');
  }
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(opts.attrs ?? {})) el.setAttribute(k, v);
  if (opts.childrenHTML) el.innerHTML = opts.childrenHTML;
  document.body.appendChild(el);
  const html = el.outerHTML;
  el.remove();
  return html;
}
