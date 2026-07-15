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

describe('REQ-14 — user imports resolve (bare npm verbatim, local .ts relative)', () => {
  it('threads baseDir so uidetox stays bare and local .ts becomes project-relative', () => {
    const root = mkdtempSync(join(tmpdir(), 'dtx-imp-'));
    writeFileSync(join(root, 'detox.toml'), 'resolve.includes = ["src"]\nresolve.extensions = [".dtx", ".md", ".ts"]\n');
    mkdirSync(join(root, 'src', 'pages'), { recursive: true });
    writeFileSync(join(root, 'src', 'tokens.ts'), 'export const authToken = 1;');
    const login = join(root, 'src', 'pages', 'Login.dtx');
    writeFileSync(login,
      'import registry from "ui-detox"\n' +
      'import form, f from "ui-detox/forms"\n' +
      'import authToken from "tokens"\n' +
      'component LoginPage tag login-page\ntemplate\n<div/>\nend template\nend component\n');

    const p = uidetox({ root });
    const src = (p.load as (id: string) => string | null)(login)!;
    const out = (p.transform as (c: string, id: string) => { code: string } | null)(src, login);
    expect(out?.code).toContain('import { registry } from "ui-detox";');        // bare npm, NOT ./uidetox.js
    expect(out?.code).toContain('import { form, f } from "ui-detox/forms";');    // scoped subpath verbatim
    expect(out?.code).toContain('import { authToken } from "../tokens.ts";');      // local .ts, project-relative
    expect(out?.code).not.toContain('./uidetox.js');
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
    expect(resolveCb!({ path: 'ui-detox' })).toBeNull();       // npm passthrough
    expect(resolveCb!({ path: 'ui-detox' })).toBeNull();
  });
});
