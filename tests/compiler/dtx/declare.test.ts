import { describe, expect, it } from 'vitest';
import { parseDtx } from '../../../src/compiler/dtx/parse.js';
import { compileDtx } from '../../../src/compiler/dtx/index.js';

describe('declare', () => {
  it('parses a declared tpl', () => {
    const src = `declare tpl card-header
<header><slot/></header>
end tpl
`;
    const ast = parseDtx(src);
    expect(ast.declares).toHaveLength(1);
    expect(ast.declares[0]).toMatchObject({ kind: 'tpl', name: 'card-header' });
    expect(ast.declares[0].body).toContain('<header>');
  });

  it('emits declared tpl as a factory, style as string, props as names', () => {
    const src = `declare tpl card-header
<header>${'${title}'}</header>
end tpl

declare style surface
.surface { border-radius: 8px; }
end style

declare props pagination
number page
number? perPage 20
end props
`;
    const { code } = compileDtx(src);
    expect(code).toContain('export const cardHeader = (ctx) =>');
    expect(code).toContain('__el("header"');
    expect(code).toContain("export const surface = '.surface { border-radius: 8px; }'");
    expect(code).toContain('export const pagination = ["page","perPage"]');
  });
});
