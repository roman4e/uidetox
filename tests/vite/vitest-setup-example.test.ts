import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createUidetoxCore } from '../../src/vite/plugin.js';

const md = readFileSync(resolve(process.cwd(), 'examples/vitest-setup/src/Counter.md'), 'utf8');

describe('vitest-setup example (§11.9)', () => {
  it('test mode re-emits __tests + __fixtures; build strips them', () => {
    const test = createUidetoxCore({ mode: 'test' }).transform(md, 'Counter.md');
    expect(test?.code).toContain('defineComponent');
    expect(test?.code).toContain('export function __tests()');
    expect(test?.code).toContain("it('starts at zero'");
    expect(test?.code).toContain('export const __fixtures =');

    const build = createUidetoxCore({ mode: 'build' }).transform(md, 'Counter.md');
    expect(build?.code).not.toContain('__tests');
    expect(build?.code).not.toContain("it('starts at zero'");
  });
});
