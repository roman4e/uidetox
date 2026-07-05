import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { collectShimEntries, buildShimsFile } from '../../src/vite/shims.js';
import { createUidetoxCore } from '../../src/vite/plugin.js';

const projectRoot = resolve(process.cwd(), 'examples/culinary-lite');
const config = { resolve: { includes: ['src'], extensions: ['.dtx', '.md'] }, build: {} };

describe('collectShimEntries', () => {
  it('maps files under include roots to dotted specifiers', () => {
    const entries = collectShimEntries(config, projectRoot);
    const specs = entries.map((e) => e.spec).sort();
    expect(specs).toContain('pages.Login');
    expect(specs).toContain('pages.Dashboard');
    expect(specs).toContain('routes');
  });
});

describe('buildShimsFile', () => {
  it('emits ambient module declarations with Props + default export', () => {
    const entries = collectShimEntries(config, projectRoot);
    const file = buildShimsFile(entries);
    expect(file).toContain('declare module "pages.Login" {');
    expect(file).toContain('export default _default;');
    expect(file).toContain('_default: (props?: Props) => HTMLElement');
  });
});

describe('core.writeShims', () => {
  it('writes .uidetox/dtx-shims.d.ts', () => {
    const core = createUidetoxCore({ root: projectRoot });
    const out = core.writeShims();
    expect(out).toBe(join(projectRoot, '.uidetox', 'dtx-shims.d.ts'));
    expect(readFileSync(out, 'utf8')).toContain('declare module "pages.Login"');
  });
});
