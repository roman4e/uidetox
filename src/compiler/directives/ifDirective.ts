import type { TplElement, TplIf, TplNode } from '../template/ast.js';
import type { DirectiveTransform } from '../template/transform.js';

function findWhen(node: TplElement): string {
  const attr = node.attrs.find((a) => a.name === 'when');
  if (!attr) throw new Error('<if> requires a "when" attribute');
  return attr.value;
}

function splitThenElse(children: TplNode[]): { thenNodes: TplNode[]; elseNodes: TplNode[] | null } {
  const elseIdx = children.findIndex(
    (c) => c.type === 'element' && c.tag === 'else',
  );
  if (elseIdx === -1) return { thenNodes: children, elseNodes: null };
  // `<else>` is a container (implicitly closed at `</if>` — see rewriteControlFlow):
  // then-branch is the nodes before it, else-branch is its children.
  const elseEl = children[elseIdx] as TplElement;
  return {
    thenNodes: children.slice(0, elseIdx),
    elseNodes: elseEl.children,
  };
}

export const transformIf: DirectiveTransform = (node) => {
  const condition = findWhen(node);
  const { thenNodes, elseNodes } = splitThenElse(node.children);
  const result: TplIf = {
    type: 'if',
    condition,
    then: thenNodes,
    else: elseNodes,
  };
  return { node: result, consumeNext: 0 };
};
