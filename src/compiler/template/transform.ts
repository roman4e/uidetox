import type { TplElement, TplNode } from './ast.js';
import { transformIf } from '../directives/ifDirective.js';
import { transformFor } from '../directives/forDirective.js';

export type DirectiveTransform = (
  node: TplElement,
  siblings: TplNode[],
  index: number,
) => { node: TplNode; consumeNext: number } | null;

const DIRECTIVES: Record<string, DirectiveTransform> = {
  if: transformIf,
  for: transformFor,
};

export function transformDirectives(nodes: TplNode[]): TplNode[] {
  const out: TplNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === 'element' && DIRECTIVES[node.tag]) {
      const result = DIRECTIVES[node.tag](node, nodes, i);
      if (result) {
        // recurse into the transformed node's body
        const recursed = recurseInto(result.node);
        out.push(recursed);
        i += result.consumeNext;
        continue;
      }
    }
    if (node.type === 'element') {
      out.push({ ...node, children: transformDirectives(node.children) });
    } else {
      out.push(node);
    }
  }
  return out;
}

function recurseInto(node: TplNode): TplNode {
  if (node.type === 'if') {
    return {
      ...node,
      then: transformDirectives(node.then),
      else: node.else ? transformDirectives(node.else) : null,
    };
  }
  if (node.type === 'for') {
    return { ...node, body: transformDirectives(node.body) };
  }
  if (node.type === 'case') {
    return {
      ...node,
      arms: node.arms.map((a) => ({ ...a, body: transformDirectives(a.body) })),
    };
  }
  if (node.type === 'element') {
    return { ...node, children: transformDirectives(node.children) };
  }
  return node;
}
