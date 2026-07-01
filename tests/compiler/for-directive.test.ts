import { describe, expect, it } from 'vitest';
import { codegen } from '../../src/compiler/template/codegen.js';
import { parseTemplate } from '../../src/compiler/template/parse.js';
import { transformDirectives } from '../../src/compiler/template/transform.js';

describe('<for> directive', () => {
  it('transforms <for each="${todos}" item="t" key="t.id">', () => {
    const ast = transformDirectives(
      parseTemplate('<for each="${todos}" item="t" key="t.id"><li>x</li></for>'),
    );
    expect(ast[0]).toMatchObject({
      type: 'for',
      each: 'todos',
      itemVar: 't',
      keyExpr: 't.id',
    });
  });

  it('emits __for() call in codegen with body factory', () => {
    const ast = transformDirectives(
      parseTemplate('<for each="${todos}" item="t" key="t.id"><li>x</li></for>'),
    );
    const js = codegen(ast);
    expect(js).toContain('__for');
    expect(js).toContain('(t, index, ctx) =>');
    expect(js).toContain('(t, index) => (t.id)');
  });
});
