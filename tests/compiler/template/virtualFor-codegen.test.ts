import { describe, expect, it } from 'vitest';
import { parseTemplate } from '../../../src/compiler/template/parse.js';
import { transformDirectives } from '../../../src/compiler/template/transform.js';
import { codegen } from '../../../src/compiler/template/codegen.js';

function gen(src: string): string {
  return codegen(transformDirectives(parseTemplate(src)));
}

describe('<virtual-for> codegen', () => {
  it('lowers to __virtualFor with row-height and overscan options', () => {
    const code = gen(
      '<virtual-for each=${rows} item="r" key="r.id" row-height="48" overscan="6"><div>${r.label}</div></virtual-for>',
    );
    expect(code).toContain('__virtualFor(() => (rows)');
    expect(code).toContain('(r, index) => (r.id)');
    expect(code).toContain('(r, index, ctx) =>');
    expect(code).toContain('rowHeight: (48)');
    expect(code).toContain('overscan: (6)');
  });

  it('defaults item var and omits absent options', () => {
    const code = gen('<virtual-for each=${xs} row-height="20"><span/></virtual-for>');
    expect(code).toContain('(item, index) => index');
    expect(code).toContain('rowHeight: (20)');
    expect(code).not.toContain('overscan:');
    expect(code).not.toContain('scrollParent:');
  });

  it('quotes a static scroll-parent selector and passes an expression row-height through', () => {
    const code = gen('<virtual-for each=${xs} row-height=${h} scroll-parent="host"><span/></virtual-for>');
    expect(code).toContain('rowHeight: (h)');
    expect(code).toContain('scrollParent: ("host")');
  });

  it('emits debug:true when the debug attribute is present', () => {
    const code = gen('<virtual-for each=${xs} row-height="10" debug><span/></virtual-for>');
    expect(code).toContain('debug: true');
  });
});
