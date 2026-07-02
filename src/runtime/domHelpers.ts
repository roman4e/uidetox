import { effect } from './effect.js';
import type { TemplateCtx } from './component.js';
import { renderIf } from './directives/ifBlock.js';
import { renderFor } from './directives/forBlock.js';
import { CASE_DEFAULT, renderCase, type CaseArm } from './directives/caseBlock.js';
import { installTraits, type UseSpec } from './traits/install.js';

export { CASE_DEFAULT };

export function __use(el: Element, specs: UseSpec[]): void {
  const map = new Map<Element, UseSpec[]>();
  map.set(el, specs);
  installTraits(el, map);
}

export type AttrKind =
  | 'static'
  | 'expression'
  | 'event'
  | 'property'
  | 'boolean'
  | 'text-content';

export type AttrDescriptor =
  | [name: string, kind: 'static', value: string]
  | [name: string, kind: Exclude<AttrKind, 'static'>, value: () => unknown];

function pascalToKebab(name: string): string {
  if (!/^[A-Z]/.test(name)) return name;
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

export function __text(value: string): Text {
  return document.createTextNode(value);
}

export function __fragment(nodes: Node[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const n of nodes) frag.appendChild(n);
  return frag;
}

export function __bind(
  node: Node,
  kind: AttrKind,
  name: string,
  exprFn: () => unknown,
  _ctx: TemplateCtx,
): Node {
  if (kind === 'text-content') {
    effect(() => {
      (node as Text).data = String(exprFn() ?? '');
    });
    return node;
  }
  const el = node as HTMLElement;
  const attrName = name.replace(/^[@.?]/, '');
  if (kind === 'event') {
    let current: ((e: Event) => void) | null = null;
    effect(() => {
      if (current) el.removeEventListener(attrName, current);
      const handler = exprFn() as (e: Event) => void;
      current = handler;
      el.addEventListener(attrName, handler);
    });
    return el;
  }
  if (kind === 'property') {
    effect(() => {
      (el as unknown as Record<string, unknown>)[attrName] = exprFn();
    });
    return el;
  }
  if (kind === 'boolean') {
    effect(() => {
      if (exprFn()) el.setAttribute(attrName, '');
      else el.removeAttribute(attrName);
    });
    return el;
  }
  // 'expression'
  effect(() => {
    const value = exprFn();
    if (value === false || value === null || value === undefined) {
      el.removeAttribute(attrName);
    } else {
      el.setAttribute(attrName, String(value));
    }
  });
  return el;
}

export function __el(
  tag: string,
  attrs: AttrDescriptor[],
  children: Node[],
  ctx: TemplateCtx,
): HTMLElement {
  const resolved = pascalToKebab(tag);
  const el = document.createElement(resolved);
  for (const [name, kind, value] of attrs) {
    if (kind === 'static') {
      el.setAttribute(name, value as string);
    } else {
      __bind(el, kind, name, value as () => unknown, ctx);
    }
  }
  for (const child of children) el.appendChild(child);
  return el;
}

export function __if(
  cond: () => unknown,
  whenTrue: (ctx: TemplateCtx) => Node,
  whenFalse: ((ctx: TemplateCtx) => Node) | null,
  ctx: TemplateCtx,
): Node {
  const anchor = document.createTextNode('');
  queueMicrotask(() => {
    if (!anchor.parentNode) return;
    renderIf(anchor.parentNode, anchor, cond, whenTrue, whenFalse, ctx);
  });
  return anchor;
}

export function __for<T>(
  source: () => T[],
  keyOf: (item: T, index: number) => unknown,
  bodyFactory: (item: T, index: number, ctx: TemplateCtx) => Node,
  ctx: TemplateCtx,
): Node {
  const anchor = document.createTextNode('');
  queueMicrotask(() => {
    if (!anchor.parentNode) return;
    renderFor(anchor.parentNode, anchor, source, keyOf, bodyFactory, ctx);
  });
  return anchor;
}

export function __case(
  subject: () => unknown,
  arms: CaseArm[],
  ctx: TemplateCtx,
): Node {
  const anchor = document.createTextNode('');
  queueMicrotask(() => {
    if (!anchor.parentNode) return;
    renderCase(anchor.parentNode, anchor, subject, arms, ctx);
  });
  return anchor;
}
