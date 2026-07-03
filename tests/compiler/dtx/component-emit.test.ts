import { describe, expect, it } from 'vitest';
import { compileDtx } from '../../../src/compiler/dtx/index.js';

describe('component emit', () => {
  it('emits defineComponent call with template + style', () => {
    const src = `component AppCard export tag "app-card"
template { <div class="card"><h2>hi</h2></div> }
style scoped { .card { padding: 1rem; } }
`;
    const { code } = compileDtx(src);
    expect(code).toContain('import { defineComponent');
    expect(code).toContain("export const AppCard = defineComponent({");
    expect(code).toContain("tag: 'app-card'");
    expect(code).toContain('__el("div"');
    expect(code).toContain('.card { padding: 1rem; }');
  });

  it('splices actions body into boot before template', () => {
    const src = `component X tag "x-x"
actions { const greeting = 'hi'; }
template { <div>hello</div> }
`;
    const { code } = compileDtx(src);
    expect(code).toContain("const greeting = 'hi';");
    expect(code).toContain('__el("div"');
  });
});
