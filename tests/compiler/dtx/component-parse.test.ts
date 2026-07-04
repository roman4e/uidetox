import { describe, expect, it } from 'vitest';
import { parseDtx } from '../../../src/compiler/dtx/parse.js';

describe('parse component', () => {
  it('parses component with section members', () => {
    const src = `component AppCard tag app-card

template
<div>x</div>
end template

style scoped
.card { padding: 1rem; }
end style

actions
function onClick() { console.log('c'); }
end actions

end component
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

  it('accepts tpl as template alias', () => {
    const src = `component X tag x-x
tpl
<span/>
end tpl
end component
`;
    const decl = parseDtx(src).declarations[0];
    expect(decl.members.find((m) => m.kind === 'template')?.body.trim()).toBe('<span/>');
  });
});
