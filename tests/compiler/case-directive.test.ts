import { describe, expect, it } from 'vitest';
import { codegen } from '../../src/compiler/template/codegen.js';
import { parseTemplate } from '../../src/compiler/template/parse.js';
import { transformDirectives } from '../../src/compiler/template/transform.js';

describe('<case> directive', () => {
  it('transforms case/when/else into TplCase arms', () => {
    const ast = transformDirectives(
      parseTemplate(
        '<case on="${status}"><when is="loading">L</when><when is="error">E</when><else>D</else></case>',
      ),
    );
    expect(ast[0]).toEqual({
      type: 'case',
      on: 'status',
      arms: [
        { match: 'loading', body: [{ type: 'text', value: 'L' }] },
        { match: 'error',   body: [{ type: 'text', value: 'E' }] },
        { match: null,      body: [{ type: 'text', value: 'D' }] },
      ],
    });
  });

  it('emits __case() with CASE_DEFAULT for else arm', () => {
    const ast = transformDirectives(
      parseTemplate('<case on="${x}"><when is="a">A</when><else>B</else></case>'),
    );
    const js = codegen(ast);
    expect(js).toContain('__case(() => (x)');
    expect(js).toContain('"a"');
    expect(js).toContain('CASE_DEFAULT');
  });
});
