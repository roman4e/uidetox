import { describe, expect, it } from 'vitest';
import { parseTemplate } from '../../../src/compiler/template/parse.js';
import { transformRouteElement } from '../../../src/compiler/routes/routeTransform.js';

function root(source: string) {
  return parseTemplate(source)[0] as never;
}

describe('transformRouteElement()', () => {
  it('captures path and handler expression', () => {
    const ast = transformRouteElement(root('<Route path="/users" to="${UsersList}"/>'), '');
    expect(ast.path).toBe('/users');
    expect(ast.handlerExpr).toBe('UsersList');
    expect(ast.paramsSource).toBe('{}');
    expect(ast.guards).toEqual([]);
    expect(ast.status).toBeNull();
  });

  it('resolves parent-relative path via ...', () => {
    const ast = transformRouteElement(root('<Route path=".../:id" to="${UserProfile}"><param :id="number"/></Route>'), '/users');
    expect(ast.path).toBe('/users/:id');
    expect(ast.paramsSource).toContain('id: {');
    expect(ast.paramsSource).toContain('type: "number"');
  });

  it('collects guards and status', () => {
    const ast = transformRouteElement(root('<Route path="/gone" to="${Gone}" status="410"/>'), '');
    expect(ast.status).toBe(410);
    const with_before = transformRouteElement(root('<Route path="/admin" to="${A}" before="${[a,b]}"/>'), '');
    expect(with_before.guards).toEqual(['a,b']);
  });
});
