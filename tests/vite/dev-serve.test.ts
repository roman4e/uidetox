import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { uidetox, uidetoxEsbuild } from '../../src/vite/plugin.js';

const DTX = `component Login tag app-login
template
<div class="card"><slot/></div>
end template
end component
`;

function project(): { root: string; loginPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'dtx-serve-'));
  writeFileSync(join(root, 'detox.toml'), 'resolve.includes = ["src"]\nresolve.extensions = [".dtx"]\n');
  mkdirSync(join(root, 'src', 'pages'), { recursive: true });
  const loginPath = join(root, 'src', 'pages', 'Login.dtx');
  writeFileSync(loginPath, DTX);
  writeFileSync(join(root, 'src', 'routes.dtx'), 'router R export\nroutes\n"/" -> Home\nend routes\nend router\n');
  return { root, loginPath };
}

describe('Bug 10.1 — load hook makes dev serve compile .dtx', () => {
  it('load() returns the raw source so transform can compile it', () => {
    const { root, loginPath } = project();
    const p = uidetox({ root });
    const src = (p.load as (id: string) => string | null)(loginPath);
    expect(src).toContain('component Login');           // raw source served
    // transform then compiles it (even with a ?query suffix from Vite)
    const out = (p.transform as (c: string, id: string) => { code: string } | null)(src!, loginPath + '?v=123');
    expect(out?.code).toContain('defineComponent');
    expect(out?.code).toContain('tag: "app-login"');
  });

  it('load() ignores non-component ids', () => {
    const p = uidetox();
    expect((p.load as (id: string) => string | null)('/x/main.ts')).toBeNull();
  });
});

describe('Bug 10.2 — esbuild resolves bare + dotted specifiers during scan', () => {
  it('onResolve maps dotted and single-segment refs, passes npm through', () => {
    const { root } = project();
    const plugin = uidetoxEsbuild({ root });
    let resolveCb: ((a: { path: string }) => { path: string } | null) | null = null;
    plugin.setup({
      onResolve: (_f, cb) => { resolveCb = cb as typeof resolveCb; },
      onLoad: () => {},
    });
    expect(resolveCb!({ path: 'pages.Login' })!.path).toBe(join(root, 'src', 'pages', 'Login.dtx'));
    expect(resolveCb!({ path: 'routes' })!.path).toBe(join(root, 'src', 'routes.dtx'));
    expect(resolveCb!({ path: 'uidetox' })).toBeNull();       // npm passthrough
    expect(resolveCb!({ path: 'uidetox' })).toBeNull();
  });
});
