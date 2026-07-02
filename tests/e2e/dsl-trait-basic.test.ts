import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileDtx } from '../../src/compiler/dtx/index.js';

describe('dsl trait basic', () => {
  it('compiles inputs.dtx to a defineTrait module', () => {
    const src = readFileSync(join(process.cwd(), 'examples/dsl/traits/inputs.dtx'), 'utf8');
    const { code } = compileDtx(src);
    expect(code).toContain('defineTrait');
    expect(code).toContain("'trim'");
    expect(code).toContain('trim_handler');
    expect(code).toContain('this.el.value.trim()');
  });

  it('compiles text.dtx to a defineFilter module', () => {
    const src = readFileSync(join(process.cwd(), 'examples/dsl/filters/text.dtx'), 'utf8');
    const { code } = compileDtx(src);
    expect(code).toContain('defineFilter');
    expect(code).toContain("'lowercase'");
    expect(code).toContain('v.toLowerCase()');
  });
});
