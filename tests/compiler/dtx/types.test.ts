import { describe, expect, it } from 'vitest';
import type { Declaration, DtxAst } from '../../../src/compiler/dtx/types.js';

describe('dtx types', () => {
  it('shapes compile', () => {
    const decl: Declaration = {
      verb: 'trait',
      name: 'trim',
      clauses: [],
      members: [],
      sourceOffset: 0,
      sourceEndOffset: 10,
    };
    const ast: DtxAst = { imports: [], declarations: [decl] };
    expect(ast.declarations[0].name).toBe('trim');
  });
});
