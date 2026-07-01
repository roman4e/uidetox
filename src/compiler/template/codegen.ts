import type {
  TplAttr,
  TplElement,
  TplInterpolation,
  TplNode,
  TplText,
} from './ast.js';

function q(s: string): string {
  return JSON.stringify(s);
}

function attrsExpr(attrs: TplAttr[]): string {
  const items = attrs.map((a) => {
    if (a.kind === 'static') {
      return `[${q(a.name)}, "static", ${q(a.value)}]`;
    }
    return `[${q(a.name)}, ${q(a.kind)}, () => (${a.value})]`;
  });
  return `[${items.join(', ')}]`;
}

function nodeExpr(node: TplNode): string {
  if (node.type === 'text') return textExpr(node);
  if (node.type === 'interpolation') return interpolationExpr(node);
  return elementExpr(node);
}

function textExpr(node: TplText): string {
  return `__text(${q(node.value)})`;
}

function interpolationExpr(node: TplInterpolation): string {
  return `__bind(__text(""), "text-content", "", () => (${node.expression}), ctx)`;
}

function elementExpr(node: TplElement): string {
  const children = node.children.map(nodeExpr).join(', ');
  return `__el(${q(node.tag)}, ${attrsExpr(node.attrs)}, [${children}], ctx)`;
}

export function codegen(nodes: TplNode[]): string {
  if (nodes.length === 1) return nodeExpr(nodes[0]);
  const parts = nodes.map(nodeExpr).join(', ');
  return `__fragment([${parts}])`;
}
