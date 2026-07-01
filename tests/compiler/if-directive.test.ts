import { describe, expect, it } from 'vitest';
import { transformDirectives } from '../../src/compiler/template/transform.js';
import { codegen } from '../../src/compiler/template/codegen.js';
import { parseTemplate } from '../../src/compiler/template/parse.js';

describe('<if> directive', () => {
  it('transforms <if when=${cond}>...<else>...</else></if>', () => {
    const ast = transformDirectives(
      parseTemplate('<if when="${open}">yes<else>no</else></if>'),
    );
    expect(ast).toEqual([
      {
        type: 'if',
        condition: 'open',
        then: [{ type: 'text', value: 'yes' }],
        else: [{ type: 'text', value: 'no' }],
      },
    ]);
  });

  it('emits __if() call in codegen', () => {
    const ast = transformDirectives(parseTemplate('<if when="${open}">yes</if>'));
    const js = codegen(ast);
    expect(js).toContain('__if');
    expect(js).toContain('() => (open)');
  });
});
