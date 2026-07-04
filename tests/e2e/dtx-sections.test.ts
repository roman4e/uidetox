import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileDtx } from '../../src/compiler/dtx/index.js';

describe('dtx sections e2e', () => {
  it('compiles a full section-based component', () => {
    const src = readFileSync(join(process.cwd(), 'examples/dsl/components/Counter.dtx'), 'utf8');
    const { code } = compileDtx(src);
    // component + tag
    expect(code).toContain('export const Counter = defineComponent({');
    expect(code).toContain('tag: "app-counter"');
    expect(code).toContain('props: ["start"]');
    // script (private boot)
    expect(code).toContain('const s = state({ count: props.start ?? 0 });');
    // actions (functions + host wiring)
    expect(code).toContain('function inc()');
    expect(code).toContain('host.inc = inc;');
    expect(code).toContain('host.dec = dec;');
    // template with refs + interpolation
    expect(code).toContain('__ref(ctx, "dec"');
    expect(code).toContain('__ref(ctx, "inc"');
    expect(code).toContain('() => (s.count)');
    // style
    expect(code).toContain('.counter { display: flex; gap: 1rem; }');
  });
});
