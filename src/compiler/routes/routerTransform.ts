import type { TplElement } from '../template/ast.js';
import { transformRouteElement, type RouteAst } from './routeTransform.js';

export type RouterMode = 'history' | 'hash';
export type SlashPolicy = 'strict' | 'narrowing' | 'expanding';

export interface RouterAst {
  mount: string;
  mode: RouterMode;
  slashPolicy: SlashPolicy;
  guards: string[];
  priority: number;
  disabled: boolean;
  routes: RouteAst[];
}

function attrVal(node: TplElement, name: string, fallback: string): string {
  return node.attrs.find((a) => a.name === name)?.value ?? fallback;
}
function attrHas(node: TplElement, name: string): boolean {
  return node.attrs.some((a) => a.name === name);
}
function parseGuardExpr(v: string): string[] {
  const trimmed = v.trim();
  if (trimmed === 'null' || trimmed === '[]') return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return [trimmed.slice(1, -1).trim()];
  }
  return [trimmed];
}

export function transformRouterElement(node: TplElement): RouterAst {
  const mount = attrVal(node, 'from', '');
  const mode = (attrVal(node, 'mode', 'history') as RouterMode);
  const slashPolicy = (attrVal(node, 'slashPolicy', 'strict') as SlashPolicy);
  const priorityRaw = attrVal(node, 'priority', '50');
  const priority = Number(priorityRaw) || 50;
  const disabled = attrHas(node, 'disabled');
  const beforeAttr = node.attrs.find((a) => a.name === 'before');
  const guards = beforeAttr ? parseGuardExpr(beforeAttr.value) : [];

  const routes: RouteAst[] = [];
  for (const child of node.children) {
    if (child.type !== 'element') continue;
    if (child.tag === 'Route' || child.tag === 'route') {
      routes.push(transformRouteElement(child, mount));
    }
  }

  return { mount, mode, slashPolicy, priority, disabled, guards, routes };
}
