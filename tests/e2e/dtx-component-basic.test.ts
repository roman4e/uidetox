import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileDtx } from '../../src/compiler/dtx/index.js';

describe('dtx component e2e', () => {
  it('compiles AppCard.dtx to defineComponent module', () => {
    const src = readFileSync(join(process.cwd(), 'examples/dsl/components/AppCard.dtx'), 'utf8');
    const { code } = compileDtx(src);
    expect(code).toContain('export const AppCard = defineComponent({');
    expect(code).toContain('tag: "app-card"');
    expect(code).toContain('__el("div"');
    expect(code).toContain('padding: 1rem');
  });
});
