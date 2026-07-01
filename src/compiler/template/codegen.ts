import type {
  TplAttr,
  TplCase,
  TplElement,
  TplFor,
  TplIf,
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
  if (node.type === 'if') return ifExpr(node);
  if (node.type === 'for') return forExpr(node);
  if (node.type === 'case') return caseExpr(node);
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

function childrenBlock(children: TplNode[]): string {
  if (children.length === 0) return 'document.createDocumentFragment()';
  if (children.length === 1) return nodeExpr(children[0]);
  return `__fragment([${children.map(nodeExpr).join(', ')}])`;
}

function ifExpr(node: TplIf): string {
  const thenBody = childrenBlock(node.then);
  const elseBody = node.else ? `(ctx) => ${childrenBlock(node.else)}` : 'null';
  return `__if(() => (${node.condition}), (ctx) => ${thenBody}, ${elseBody}, ctx)`;
}

function forExpr(node: TplFor): string {
  const body = childrenBlock(node.body);
  const key = node.keyExpr
    ? `(${node.itemVar}, index) => (${node.keyExpr})`
    : `(${node.itemVar}, index) => index`;
  return `__for(() => (${node.each}), ${key}, (${node.itemVar}, index, ctx) => ${body}, ctx)`;
}

function caseExpr(node: TplCase): string {
  const arms = node.arms
    .map((arm) => {
      const matchLiteral = arm.match === null ? 'CASE_DEFAULT' : q(arm.match);
      const body = childrenBlock(arm.body);
      return `{ match: ${matchLiteral}, factory: (ctx) => ${body} }`;
    })
    .join(', ');
  return `__case(() => (${node.on}), [${arms}], ctx)`;
}

export function codegen(nodes: TplNode[]): string {
  if (nodes.length === 1) return nodeExpr(nodes[0]);
  const parts = nodes.map(nodeExpr).join(', ');
  return `__fragment([${parts}])`;
}
