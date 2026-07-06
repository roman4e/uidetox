import { effect } from './effect.js';
import type { TemplateCtx } from './component.js';
import { renderIf } from './directives/ifBlock.js';
import { renderFor } from './directives/forBlock.js';
import { renderVirtualFor, type VirtualForOptions } from './directives/virtualForBlock.js';
import { CASE_DEFAULT, renderCase, type CaseArm } from './directives/caseBlock.js';
import { installTraits, type UseSpec } from './traits/install.js';
import { getCurrentScope, runInScope } from './scope.js';

export { CASE_DEFAULT };

export function __use(el: Element, specs: UseSpec[]): void {
  const map = new Map<Element, UseSpec[]>();
  map.set(el, specs);
  installTraits(el, map);
}

export function __ref(ctx: TemplateCtx, key: string, el: Element): Element {
  if (key) ctx.refs[key] = el;
  return el;
}

/** Field-handle shape consumed by two-way form binding (decoupled from forms). */
export interface BoundField {
  value: unknown;
  setValue(v: unknown): void;
  setTouched(t: boolean): void;
}

function fieldKind(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'select') return 'select';
  if (tag === 'textarea') return 'text';
  const type = (el.getAttribute('type') ?? 'text').toLowerCase();
  return type;
}

/** Two-way binds a form field to an input/select/textarea element. */
export function __bindField(el: HTMLElement, field: BoundField): HTMLElement {
  const kind = fieldKind(el);
  const input = el as HTMLInputElement;
  effect(() => {
    const v = field.value;
    if (kind === 'checkbox') input.checked = !!v;
    else input.value = v === null || v === undefined ? '' : String(v);
  });
  const read = (): unknown => {
    if (kind === 'checkbox') return input.checked;
    if (kind === 'number' || kind === 'range') return input.value === '' ? undefined : Number(input.value);
    return input.value;
  };
  const onInput = () => field.setValue(read());
  const onBlur = () => field.setTouched(true);
  el.addEventListener('input', onInput);
  el.addEventListener('change', onInput);
  el.addEventListener('blur', onBlur);
  return el;
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

import { mutate } from './dom/stage.js';

export function __bind(
  node: Node,
  kind: AttrKind,
  name: string,
  exprFn: () => unknown,
  _ctx: TemplateCtx,
): Node {
  if (kind === 'text-content') {
    let isFirst = true;
    effect(() => {
      const next = String(exprFn() ?? '');
      if (isFirst) {
        isFirst = false;
        (node as Text).data = next;
      } else {
        mutate(node, 'text', '', next);
      }
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
    let firstProp = true;
    effect(() => {
      const next = exprFn();
      if (firstProp) {
        firstProp = false;
        (el as unknown as Record<string, unknown>)[attrName] = next;
      } else {
        mutate(el, 'prop', attrName, next);
      }
    });
    return el;
  }
  if (kind === 'boolean') {
    let firstBool = true;
    effect(() => {
      const next = !!exprFn();
      if (firstBool) {
        firstBool = false;
        if (next) el.setAttribute(attrName, '');
        else el.removeAttribute(attrName);
      } else {
        mutate(el, 'boolean', attrName, next);
      }
    });
    return el;
  }
  // 'expression'
  let firstExpr = true;
  effect(() => {
    const value = exprFn();
    if (firstExpr) {
      firstExpr = false;
      if (value === false || value === null || value === undefined) {
        el.removeAttribute(attrName);
      } else {
        el.setAttribute(attrName, String(value));
      }
    } else {
      mutate(el, 'attr', attrName, value);
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
  const scope = getCurrentScope();
  queueMicrotask(() => {
    if (!anchor.parentNode) return;
    runInScope(scope, () => renderIf(anchor.parentNode!, anchor, cond, whenTrue, whenFalse, ctx));
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
  const scope = getCurrentScope();
  queueMicrotask(() => {
    if (!anchor.parentNode) return;
    runInScope(scope, () => renderFor(anchor.parentNode!, anchor, source, keyOf, bodyFactory, ctx));
  });
  return anchor;
}

export function __virtualFor<T>(
  source: () => T[],
  keyOf: (item: T, index: number) => unknown,
  bodyFactory: (item: T, index: number, ctx: TemplateCtx) => Node,
  ctx: TemplateCtx,
  opts: VirtualForOptions,
): Node {
  return renderVirtualFor(source, keyOf, bodyFactory, ctx, opts);
}

export function __case(
  subject: () => unknown,
  arms: CaseArm[],
  ctx: TemplateCtx,
): Node {
  const anchor = document.createTextNode('');
  const scope = getCurrentScope();
  queueMicrotask(() => {
    if (!anchor.parentNode) return;
    runInScope(scope, () => renderCase(anchor.parentNode!, anchor, subject, arms, ctx));
  });
  return anchor;
}
