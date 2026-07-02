import { describe, expect, it } from 'vitest';
import { parseDtx } from '../../../src/compiler/dtx/parse.js';

describe('parseDtx()', () => {
  it('parses imports', () => {
    const ast = parseDtx('from "./x.dtx" import trim, numeric-only as num\n');
    expect(ast.imports).toHaveLength(1);
    expect(ast.imports[0].path).toBe('./x.dtx');
    expect(ast.imports[0].items).toEqual([
      { source: 'trim' },
      { source: 'numeric-only', alias: 'num' },
    ]);
  });

  it('parses trait with clauses and members', () => {
    const src = `trait trim export appliesto [input, textarea] params (string? savedKey)
.saved_at = 0
on blur trim_handler() {
  this.el.value = this.el.value.trim();
}
`;
    const ast = parseDtx(src);
    expect(ast.declarations).toHaveLength(1);
    const decl = ast.declarations[0];
    expect(decl.verb).toBe('trait');
    expect(decl.name).toBe('trim');
    expect(decl.clauses.find((c) => c.key === 'export')?.kind).toBe('flag');
    const applies = decl.clauses.find((c) => c.key === 'appliesto');
    expect(applies?.items).toEqual(['input', 'textarea']);
    const params = decl.clauses.find((c) => c.key === 'params');
    expect(params?.params).toEqual([
      { type: 'string', optional: true, name: 'savedKey' },
    ]);
    expect(decl.members[0]).toMatchObject({ kind: 'prop', name: 'saved_at', propValue: '0' });
    expect(decl.members[1]).toMatchObject({ kind: 'on', event: 'blur', name: 'trim_handler' });
    expect(decl.members[1].body).toContain('this.el.value.trim()');
  });

  it('parses filter with transform', () => {
    const src = `filter lowercase export input string output string
transform lc() { return v.toLowerCase(); }
`;
    const ast = parseDtx(src);
    expect(ast.declarations[0].verb).toBe('filter');
    expect(ast.declarations[0].clauses.find((c) => c.key === 'input')?.value).toBe('string');
    expect(ast.declarations[0].members[0]).toMatchObject({ kind: 'transform', name: 'lc' });
  });

  it('parses multiple declarations sequentially', () => {
    const src = `trait a export appliesto [input]
on blur () { x(); }
trait b appliesto [textarea]
on focus () { y(); }
`;
    const ast = parseDtx(src);
    expect(ast.declarations.map((d) => d.name)).toEqual(['a', 'b']);
  });
});
