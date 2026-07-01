import type { TplCase, TplElement } from '../template/ast.js';
import type { DirectiveTransform } from '../template/transform.js';

function readAttr(node: TplElement, name: string): string | null {
  const attr = node.attrs.find((a) => a.name === name);
  return attr ? attr.value : null;
}

export const transformCase: DirectiveTransform = (node) => {
  const on = readAttr(node, 'on');
  if (!on) throw new Error('<case> requires an "on" attribute');
  const arms: TplCase['arms'] = [];
  for (const child of node.children) {
    if (child.type !== 'element') continue;
    if (child.tag === 'when') {
      const match = readAttr(child, 'is');
      if (match === null) throw new Error('<when> requires an "is" attribute');
      arms.push({ match, body: child.children });
    } else if (child.tag === 'else') {
      arms.push({ match: null, body: child.children });
    }
  }
  const result: TplCase = { type: 'case', on, arms };
  return { node: result, consumeNext: 0 };
};
