import { describe, expect, it } from 'vitest';
import { parseDtx } from '../../../src/compiler/dtx/parse.js';

describe('parse component', () => {
  it('parses component with sub-blocks', () => {
    const src = `component AppCard tag "app-card"
template { <div>x</div> }
style scoped { .card { padding: 1rem; } }
actions { function onClick() { console.log('c'); } }
`;
    const ast = parseDtx(src);
    const decl = ast.declarations[0];
    expect(decl.verb).toBe('component');
    expect(decl.name).toBe('AppCard');
    expect(decl.clauses.find((c) => c.key === 'tag')?.value).toBe('app-card');
    const tpl = decl.members.find((m) => m.kind === 'template');
    expect(tpl?.body).toContain('<div>x</div>');
    const style = decl.members.find((m) => m.kind === 'style');
    expect(style?.scoped).toBe(true);
    expect(style?.body).toContain('.card { padding: 1rem; }');
    const actions = decl.members.find((m) => m.kind === 'actions');
    expect(actions?.body).toContain("console.log('c')");
  });
});
