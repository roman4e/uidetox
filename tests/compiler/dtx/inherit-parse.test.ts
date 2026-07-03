import { describe, expect, it } from 'vitest';
import { parseDtx } from '../../../src/compiler/dtx/parse.js';

describe('parse extends + off', () => {
  it('parses extends list-of-refs', () => {
    const ast = parseDtx('trait c extends [a, b] appliesto [input]\n');
    const decl = ast.declarations[0];
    const ext = decl.clauses.find((c) => c.key === 'extends');
    expect(ext?.kind).toBe('list-of-refs');
    expect(ext?.items).toEqual(['a', 'b']);
  });

  it('parses off members', () => {
    const src = `trait c extends [a]
off blur trim_handler()
off blur *()
off transform lc()
`;
    const ast = parseDtx(src);
    const members = ast.declarations[0].members;
    expect(members[0]).toEqual({ kind: 'off', event: 'blur', name: 'trim_handler' });
    expect(members[1]).toEqual({ kind: 'off', event: 'blur', name: null });
    expect(members[2]).toEqual({ kind: 'off', event: 'transform', name: 'lc' });
  });
});
