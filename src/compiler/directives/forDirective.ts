import type { TplElement, TplFor } from '../template/ast.js';
import type { DirectiveTransform } from '../template/transform.js';
import { buildVirtualForNode } from './virtualForDirective.js';

function readAttr(node: TplElement, name: string, required: boolean): string | null {
  const attr = node.attrs.find((a) => a.name === name);
  if (!attr) {
    if (required) throw new Error(`<for> requires a "${name}" attribute`);
    return null;
  }
  return attr.value;
}

export const transformFor: DirectiveTransform = (node) => {
  // `<for viewport="virtual">` opts into windowed rendering (same as <virtual-for>).
  const viewport = readAttr(node, 'viewport', false);
  if (viewport === 'virtual' || viewport === 'windowed') {
    return { node: buildVirtualForNode(node, '<for viewport="virtual">'), consumeNext: 0 };
  }
  const each = readAttr(node, 'each', true)!;
  const itemVar = readAttr(node, 'item', false) ?? 'item';
  const keyExpr = readAttr(node, 'key', false);
  const result: TplFor = {
    type: 'for',
    each,
    itemVar,
    keyExpr,
    body: node.children,
  };
  return { node: result, consumeNext: 0 };
};
