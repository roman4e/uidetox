import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createUidetoxCore } from '../../src/vite/plugin.js';

const projectRoot = resolve(process.cwd(), 'examples/culinary-lite');

describe('culinary-lite example project', () => {
  const core = createUidetoxCore({ root: projectRoot });

  it('resolves dotted page refs via its detox.toml', () => {
    expect(core.resolveSpecifier('pages.Login')).toBe(join(projectRoot, 'src', 'pages', 'Login.dtx'));
    expect(core.resolveSpecifier('pages.Dashboard')).toBe(join(projectRoot, 'src', 'pages', 'Dashboard.dtx'));
  });

  it('resolves a single-segment ref (routes) and lets npm bare specifiers pass', () => {
    expect(core.resolveSpecifier('routes')).toBe(join(projectRoot, 'src', 'routes.dtx'));
    expect(core.resolveSpecifier('lodash')).toBeNull();    // not under includes → npm
    expect(core.resolveSpecifier('uidetox')).toBeNull();
  });

  it('compiles both page components with unique tags', () => {
    const login = core.transform(readFileSync(join(projectRoot, 'src/pages/Login.dtx'), 'utf8'), 'Login.dtx');
    const dash = core.transform(readFileSync(join(projectRoot, 'src/pages/Dashboard.dtx'), 'utf8'), 'Dashboard.dtx');
    expect(login?.code).toContain('defineComponent');
    expect(login?.code).toContain('tag: "app-login"');
    expect(dash?.code).toContain('tag: "app-dashboard"');
  });

  it('throws a helpful error for an unknown dotted ref', () => {
    expect(() => core.resolveSpecifier('pages.Missing')).toThrow(/cannot resolve dotted module "pages.Missing"/);
  });

  it('compiles routes.dtx to a RouteEntry[] default export', () => {
    const out = core.transform(readFileSync(join(projectRoot, 'src/routes.dtx'), 'utf8'), 'routes.dtx');
    expect(out?.code).toContain('export default [');
    expect(out?.code).toContain('path: "/login", handler: Login');
    expect(out?.code).toContain('path: "/", handler: Dashboard');
    expect(out?.code).toContain('import { Login } from "./pages/Login.js";');
  });
});
