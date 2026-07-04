import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { uidetox, uidetoxEsbuild, createUidetoxCore } from '../../src/vite/plugin.js';

const DTX = `component AppCard tag app-card
template
<div class="card"><slot/></div>
end template
end component
`;

function project(): string {
  const root = mkdtempSync(join(tmpdir(), 'dtx-vite-'));
  writeFileSync(join(root, 'detox.toml'), 'resolve.includes = ["src"]\nresolve.extensions = [".dtx", ".md"]\n');
  mkdirSync(join(root, 'src', 'pages'), { recursive: true });
  writeFileSync(join(root, 'src', 'pages', 'Login.dtx'), DTX);
  return root;
}

describe('uidetox() Vite plugin', () => {
  it('exposes the expected hooks', () => {
    const p = uidetox();
    expect(p.name).toBe('uidetox');
    expect(p.enforce).toBe('pre');
    expect(typeof p.resolveId).toBe('function');
    expect(typeof p.transform).toBe('function');
    expect(typeof p.handleHotUpdate).toBe('function');
  });

  it('transform compiles a .dtx source', () => {
    const p = uidetox();
    const out = (p.transform as (c: string, id: string) => { code: string } | null)(DTX, '/x/AppCard.dtx');
    expect(out?.code).toContain('defineComponent');
  });

  it('resolveId maps a dotted ref via detox.toml', () => {
    const root = project();
    const p = uidetox({ root });
    const id = (p.resolveId as (id: string) => string | null)('pages.Login');
    expect(id).toBe(join(root, 'src', 'pages', 'Login.dtx'));
  });

  it('resolveId returns null for non-dotted specifiers', () => {
    const p = uidetox();
    expect((p.resolveId as (id: string) => string | null)('uidetox/forms')).toBeNull();
    expect((p.resolveId as (id: string) => string | null)('./x.ts')).toBeNull();
  });

  it('handleHotUpdate triggers a full reload on component edits', () => {
    const p = uidetox();
    const sent: unknown[] = [];
    const r = (p.handleHotUpdate as (ctx: unknown) => unknown)({
      file: '/x/AppCard.dtx',
      server: { ws: { send: (m: unknown) => sent.push(m) } },
    });
    expect(sent).toEqual([{ type: 'full-reload' }]);
    expect(r).toEqual([]);
  });

  it('duplicate tags across files are a hard error', () => {
    const core = createUidetoxCore();
    core.transform(DTX, '/x/AppCard.dtx');
    expect(() => core.transform(DTX, '/y/Other.dtx')).toThrow(/duplicate custom-element tag/);
  });
});

describe('uidetoxEsbuild() plugin', () => {
  it('registers onResolve + onLoad handlers', () => {
    const root = project();
    const plugin = uidetoxEsbuild({ root });
    let resolveCb: ((a: { path: string }) => { path: string } | null) | null = null;
    let loadCb: ((a: { path: string }) => { contents: string; loader: string } | null) | null = null;
    plugin.setup({
      onResolve: (_f, cb) => { resolveCb = cb as typeof resolveCb; },
      onLoad: (_f, cb) => { loadCb = cb as typeof loadCb; },
    });
    expect(resolveCb).toBeTypeOf('function');
    expect(loadCb).toBeTypeOf('function');
    expect(resolveCb!({ path: 'pages.Login' })!.path).toBe(join(root, 'src', 'pages', 'Login.dtx'));
    const loaded = loadCb!({ path: join(root, 'src', 'pages', 'Login.dtx') });
    expect(loaded!.contents).toContain('defineComponent');
    expect(loaded!.loader).toBe('js');
  });
});
