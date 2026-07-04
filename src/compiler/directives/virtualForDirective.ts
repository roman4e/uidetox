import type { TplAttr, TplElement, TplVirtualFor } from '../template/ast.js';
import type { DirectiveTransform } from '../template/transform.js';

function attr(node: TplElement, name: string): TplAttr | undefined {
  return node.attrs.find((a) => a.name === name);
}

/** Returns a JS code string for an attribute value (numbers/exprs unquoted, static strings quoted). */
function codeValue(a: TplAttr | undefined, quoteStatic: boolean): string | null {
  if (!a) return null;
  if (a.kind === 'static') return quoteStatic ? JSON.stringify(a.value) : a.value;
  return a.value;
}

export const transformVirtualFor: DirectiveTransform = (node) => {
  const each = attr(node, 'each');
  if (!each) throw new Error('<virtual-for> requires an "each" attribute');
  const rowHeight = codeValue(attr(node, 'row-height'), false);
  if (rowHeight === null) throw new Error('<virtual-for> requires a "row-height" attribute');

  const result: TplVirtualFor = {
    type: 'virtual-for',
    each: each.value,
    itemVar: codeValue(attr(node, 'item'), false) ?? 'item',
    keyExpr: codeValue(attr(node, 'key'), false),
    rowHeight,
    overscan: codeValue(attr(node, 'overscan'), false),
    scrollParent: codeValue(attr(node, 'scroll-parent'), true),
    debug: !!attr(node, 'debug'),
    body: node.children,
  };
  return { node: result, consumeNext: 0 };
};
