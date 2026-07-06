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
    const login = core.transform(readFileSync(join(projectRoot, 'src/pages/Login.dtx'), 'utf8'), join(projectRoot, 'src/pages/Login.dtx'));
    const dash = core.transform(readFileSync(join(projectRoot, 'src/pages/Dashboard.dtx'), 'utf8'), join(projectRoot, 'src/pages/Dashboard.dtx'));
    expect(login?.code).toContain('defineComponent');
    expect(login?.code).toContain('tag: "app-login"');
    expect(dash?.code).toContain('tag: "app-dashboard"');
  });

  it('throws a helpful error for an unknown dotted ref', () => {
    expect(() => core.resolveSpecifier('pages.Missing')).toThrow(/cannot resolve dotted module "pages.Missing"/);
  });

  it('compiles routes.dtx (groups, layout/guard, params, catch-all) to RouteEntry[]', () => {
    const out = core.transform(readFileSync(join(projectRoot, 'src/routes.dtx'), 'utf8'), join(projectRoot, 'src/routes.dtx'));
    expect(out?.code).toContain('export default [');
    expect(out?.code).toContain('path: "/login", handler: Login');
    expect(out?.code).toMatch(/path: "\/", handler: Dashboard[\s\S]*?guards: \[requireAuth\][\s\S]*?meta: \{ layout: AppShell \}/);
    expect(out?.code).toContain('"id": { type: "string", optional: false }');
    expect(out?.code).toContain('path: "**", handler: NotFound');
    expect(out?.code).toContain('status: 404');
    expect(out?.code).toContain('import Login from "./pages/Login.dtx";'); // default import (REQ-16)
    expect(out?.code).not.toMatch(/import\s*\{\s*Login\s*\}\s*from/);
  });

  it('resolves layout/guard dotted refs (incl. .ts guard)', () => {
    expect(core.resolveSpecifier('layouts.AppShell')).toBe(join(projectRoot, 'src', 'layouts', 'AppShell.dtx'));
    expect(core.resolveSpecifier('lib.auth-guard')).toBe(join(projectRoot, 'src', 'lib', 'auth-guard.ts'));
  });
});
