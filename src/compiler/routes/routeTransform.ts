import type { TplAttr, TplElement } from '../template/ast.js';
import { emitParamSchema } from './paramTransform.js';

export interface RouteAst {
  path: string;
  handlerExpr: string;
  guards: string[];
  status: number | null;
  paramsSource: string;
  children: RouteAst[];
  nestedComponentExpr: string | null;
}

function attrOf(node: TplElement, name: string): TplAttr | undefined {
  return node.attrs.find((a) => a.name === name);
}

function resolvePath(raw: string, parent: string): string {
  if (raw.startsWith('...')) {
    const suffix = raw.slice(3);
    if (parent.endsWith('/') && suffix.startsWith('/')) {
      return `${parent}${suffix.slice(1)}`;
    }
    return `${parent}${suffix}`;
  }
  return raw;
}

function parseGuardExpr(attrValue: string): string[] {
  const trimmed = attrValue.trim();
  if (trimmed === 'null' || trimmed === '[]') return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return [trimmed.slice(1, -1).trim()];
  }
  return [trimmed];
}

export function transformRouteElement(node: TplElement, parentPath: string): RouteAst {
  const pathAttr = attrOf(node, 'path');
  if (!pathAttr) throw new Error('<Route> requires a path attribute');
  const toAttr = attrOf(node, 'to');
  const beforeAttr = attrOf(node, 'before');
  const statusAttr = attrOf(node, 'status');

  const path = resolvePath(pathAttr.value, parentPath);
  const handlerExpr = toAttr ? toAttr.value : 'null';
  const status = statusAttr ? Number(statusAttr.value) : null;
  const guards = beforeAttr ? parseGuardExpr(beforeAttr.value) : [];

  const paramEntries: string[] = [];
  const nestedRoutes: RouteAst[] = [];
  let nestedComponentExpr: string | null = null;

  for (const child of node.children) {
    if (child.type !== 'element') continue;
    if (child.tag === 'param') {
      const attrsPairs: Array<[string, string]> = child.attrs.map((a) => [a.name, a.value] as [string, string]);
      const emit = emitParamSchema(attrsPairs);
      const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(emit.name)
        ? emit.name
        : JSON.stringify(emit.name);
      paramEntries.push(`${key}: ${emit.source}`);
      continue;
    }
    if (child.tag === 'Route' || child.tag === 'route') {
      nestedRoutes.push(transformRouteElement(child, path));
      continue;
    }
    if (!nestedComponentExpr) {
      nestedComponentExpr = child.tag;
    }
  }

  const paramsSource = paramEntries.length === 0 ? '{}' : `{ ${paramEntries.join(', ')} }`;

  return {
    path,
    handlerExpr,
    guards,
    status,
    paramsSource,
    children: nestedRoutes,
    nestedComponentExpr,
  };
}
