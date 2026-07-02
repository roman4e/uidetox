import { describe, expect, it } from 'vitest';
import { parseTemplate } from '../../../src/compiler/template/parse.js';
import { transformDirectives } from '../../../src/compiler/template/transform.js';
import { codegen } from '../../../src/compiler/template/codegen.js';

describe('trait use compilation', () => {
  it('emits __use for elements with use=', () => {
    const ast = transformDirectives(parseTemplate('<input use="trim, numeric-only" :saved-key="${state.name}"/>'));
    const js = codegen(ast);
    expect(js).toContain('__use(');
    expect(js).toContain('"trim"');
    expect(js).toContain('"numeric-only"');
    expect(js).toContain('savedKey');
  });
});
