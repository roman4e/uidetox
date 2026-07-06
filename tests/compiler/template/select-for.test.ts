import { describe, expect, it } from 'vitest';
import { parseTemplate } from '../../../src/compiler/template/parse.js';
import { transformDirectives } from '../../../src/compiler/template/transform.js';
import { codegen } from '../../../src/compiler/template/codegen.js';
import type { TplElement, TplFor } from '../../../src/compiler/template/ast.js';

describe('control-flow inside restricted parents (REQ-20a)', () => {
  it('keeps <for> inside <select> in the AST (not stripped by parse5)', () => {
    const nodes = transformDirectives(parseTemplate(
      '<select><option value="">--</option><for each=${items} item="it" key="it.id"><option value=${it.id}>${it.label}</option></for></select>',
    ));
    const select = nodes.find((n) => n.type === 'element' && (n as TplElement).tag === 'select') as TplElement;
    expect(select).toBeDefined();
    const forNode = select.children.find((c) => c.type === 'for') as TplFor | undefined;
    expect(forNode).toBeDefined();
    expect(forNode!.itemVar).toBe('it');
    expect(forNode!.keyExpr).toBe('it.id');
    // its body is the <option>, with `it` in scope
    expect((forNode!.body[0] as TplElement).tag).toBe('option');
  });

  it('lowers to __for referencing the loop variable (no unbound `it`)', () => {
    const code = codegen(transformDirectives(parseTemplate(
      '<select><for each=${items} item="it" key="it.id"><option value=${it.id}>${it.label}</option></for></select>',
    )));
    expect(code).toContain('__for(() => (items)');
    expect(code).toContain('(it, index) => (it.id)');
    expect(code).toContain('(it, index, ctx) =>');
  });

  it('keeps <if> inside <table>/<tbody>', () => {
    const nodes = transformDirectives(parseTemplate(
      '<table><tbody><if when=${ok}><tr><td>x</td></tr></if></tbody></table>',
    ));
    const table = nodes.find((n) => n.type === 'element') as TplElement;
    const tbody = table.children.find((c) => c.type === 'element' && (c as TplElement).tag === 'tbody') as TplElement;
    expect(tbody.children.some((c) => c.type === 'if')).toBe(true);
  });
});
