import type { TplElement, TplFor } from '../template/ast.js';
import type { DirectiveTransform } from '../template/transform.js';

function readAttr(node: TplElement, name: string, required: boolean): string | null {
  const attr = node.attrs.find((a) => a.name === name);
  if (!attr) {
    if (required) throw new Error(`<for> requires a "${name}" attribute`);
    return null;
  }
  return attr.value;
}

export const transformFor: DirectiveTransform = (node) => {
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
