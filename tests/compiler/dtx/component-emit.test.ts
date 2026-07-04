import { describe, expect, it } from 'vitest';
import { compileDtx } from '../../../src/compiler/dtx/index.js';

describe('component emit', () => {
  it('emits defineComponent call with template + style', () => {
    const src = `component AppCard export tag app-card

template
<div class="card"><h2>hi</h2></div>
end template

style scoped
.card { padding: 1rem; }
end style

end component
`;
    const { code } = compileDtx(src);
    expect(code).toContain('import { defineComponent');
    expect(code).toContain("export const AppCard = defineComponent({");
    expect(code).toContain('tag: "app-card"');
    expect(code).toContain('__el("div"');
    expect(code).toContain('.card { padding: 1rem; }');
  });

  it('wires actions as host methods', () => {
    const src = `component X tag x-x

actions
function inc() { count++; }
end actions

template
<div>hello</div>
end template

end component
`;
    const { code } = compileDtx(src);
    expect(code).toContain('function inc()');
    expect(code).toContain('host.inc = inc;');
    expect(code).toContain('__el("div"');
  });
});
