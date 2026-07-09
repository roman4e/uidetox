import { describe, expect, it } from 'vitest';
import { compileDtx } from '../../src/compiler/dtx/index.js';

describe('dtx task section', () => {
  it('compiles a task block into ctx.task(async signal)', () => {
    const src = `component ProductList tag product-list

script
const filter = state({ q: '' });
const items = state({ list: [] });
end script

task
const q = filter.q;
const res = await fetch(\`/api/products?q=\${q}\`, { signal });
if (!signal.aborted) items.list = await res.json();
end task

template
<ul><for each=\${items.list} item="p" key="p.id"><li>\${p.name}</li></for></ul>
end template

end component
`;
    const { code } = compileDtx(src);
    expect(code).toContain('task(async (signal) => {');
    expect(code).toContain('const q = filter.q;');
    expect(code).toContain('signal.aborted');
    expect(code).toContain('const { props, host, refs, ref, find, findAll, effect, emit, registry, task, onCleanup } = ctx;');
  });

  it('honours the idle modifier', () => {
    const src = `component X tag x-x
task idle
doWork();
end task
template
<div/>
end template
end component
`;
    const { code } = compileDtx(src);
    expect(code).toContain('}, { idle: true });');
  });
});
