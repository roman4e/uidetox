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

const PARAM_ATTR_RE = /^:([a-z][a-z0-9-]*)(?::([a-z][a-z0-9-]*))?$/;

function kebabCamel(s: string): string {
  return s.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function useSpecExpr(useValue: string, paramAttrs: TplAttr[]): string {
  const traitNames = useValue.split(',').map((s) => s.trim()).filter(Boolean);
  const shared: TplAttr[] = [];
  const perTrait = new Map<string, TplAttr[]>();
  for (const a of paramAttrs) {
    const m = PARAM_ATTR_RE.exec(a.name);
    if (!m) continue;
    if (m[2] === undefined) shared.push(a);
    else {
      if (!perTrait.has(m[1])) perTrait.set(m[1], []);
      perTrait.get(m[1])!.push(a);
    }
  }
  const specs = traitNames.map((traitName) => {
    const attrs = [...shared, ...(perTrait.get(traitName) ?? [])];
    const entries = attrs.map((a) => {
      const m = PARAM_ATTR_RE.exec(a.name)!;
      const key = kebabCamel(m[2] ?? m[1]);
      const valueExpr = a.kind === 'static' ? q(a.value) : `(${a.value})`;
      return `${key}: ${valueExpr}`;
    });
    return `{ traitName: ${q(traitName)}, params: { ${entries.join(', ')} } }`;
  });
  return `[${specs.join(', ')}]`;
}

function refWrap(node: TplElement, inner: string): string {
  if (node.refExpr) return `__ref(ctx, (${node.refExpr}), ${inner})`;
  if (node.refKey) return `__ref(ctx, ${q(node.refKey)}, ${inner})`;
  return inner;
}

function elementExpr(node: TplElement): string {
  const useAttr = node.attrs.find((a) => a.name === 'use' && a.kind === 'static');
  const bindAttr = node.attrs.find((a) => a.name === 'bind' && a.kind !== 'static');
  const paramAttrs = node.attrs.filter((a) => PARAM_ATTR_RE.test(a.name));
  const restAttrs = node.attrs.filter(
    (a) =>
      a !== useAttr &&
      a !== bindAttr &&
      !paramAttrs.includes(a) &&
      !a.name.startsWith('#'),
  );
  const children = node.children.map(nodeExpr).join(', ');
  let expr = `__el(${q(node.tag)}, ${attrsExpr(restAttrs)}, [${children}], ctx)`;
  if (useAttr) {
    const specs = useSpecExpr(useAttr.value, paramAttrs);
    expr = `(() => { const __el0 = ${expr}; __use(__el0, ${specs}); return __el0; })()`;
  }
  if (bindAttr) {
    expr = `__bindField(${expr}, (${bindAttr.value}))`;
  }
  return refWrap(node, expr);
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
