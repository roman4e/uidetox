import { describe, expect, it } from 'vitest';
import { parseTemplate } from '../../../src/compiler/template/parse.js';
import { transformRouterElement } from '../../../src/compiler/routes/routerTransform.js';

const root = (s: string) => parseTemplate(s)[0] as never;

describe('transformRouterElement()', () => {
  it('captures mount + defaults', () => {
    const ast = transformRouterElement(root('<Router><Route path="/" to="${Home}"/></Router>'));
    expect(ast.mount).toBe('');
    expect(ast.mode).toBe('history');
    expect(ast.slashPolicy).toBe('strict');
    expect(ast.priority).toBe(50);
    expect(ast.disabled).toBe(false);
    expect(ast.routes).toHaveLength(1);
    expect(ast.routes[0].path).toBe('/');
  });

  it('honours from, mode, slashPolicy, priority, disabled', () => {
    const src = '<Router from="/users/" mode="hash" slashPolicy="narrowing" priority="120" disabled><Route path=".../" to="${U}"/></Router>';
    const ast = transformRouterElement(root(src));
    expect(ast.mount).toBe('/users/');
    expect(ast.mode).toBe('hash');
    expect(ast.slashPolicy).toBe('narrowing');
    expect(ast.priority).toBe(120);
    expect(ast.disabled).toBe(true);
    expect(ast.routes[0].path).toBe('/users/');
  });

  it('captures router-level before guards', () => {
    const ast = transformRouterElement(root('<Router before="${requireAuth}"><Route path="/x" to="${X}"/></Router>'));
    expect(ast.guards).toEqual(['requireAuth']);
  });
});
