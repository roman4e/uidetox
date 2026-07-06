import { describe, expect, it } from 'vitest';
import { compileDtx } from '../../../src/compiler/dtx/index.js';

describe('router verb', () => {
  it('compiles routes to a default-exported RouteEntry[]', () => {
    const src = `import Login from "pages.Login"
import Dashboard from "pages.Dashboard"

router AppRoutes export
routes
"/login" -> Login
"/" -> Dashboard
end routes
end router
`;
    const { code } = compileDtx(src);
    expect(code).toContain('import Login from "./pages/Login.js";'); // default import (REQ-16)
    expect(code).toContain('export default [');
    expect(code).toContain('{ path: "/login", handler: Login, paramsSchema: {}, priority: 50, guards: [], status: null, meta: {} }');
    expect(code).toContain('{ path: "/", handler: Dashboard,');
  });

  it('parses per-route clauses and a param block', () => {
    const src = `router R export
routes
"/users/:id" -> UserProfile guard=require-auth priority=10 status=200 { id: string }
end routes
end router
`;
    const { code } = compileDtx(src);
    expect(code).toContain('paramsSchema: { "id": { type: "string", optional: false } }');
    expect(code).toContain('guards: [requireAuth]');
    expect(code).toContain('priority: 10');
    expect(code).toContain('status: 200');
  });

  it('applies group clauses (layout + guard) with per-route override', () => {
    const src = `router R export
routes
"/login" -> Login

group layout=AppShell guard=requireAuth
"/"            -> Dashboard
"/moderation"  -> ModerationQueue guard=requireChefAdmin
end group

"**" -> NotFound status=404
end routes
end router
`;
    const { code } = compileDtx(src);
    // group applies layout + guard
    expect(code).toContain('{ path: "/", handler: Dashboard, paramsSchema: {}, priority: 50, guards: [requireAuth], status: null, meta: { layout: AppShell } }');
    // per-route guard adds to the group guard
    expect(code).toContain('handler: ModerationQueue');
    expect(code).toMatch(/handler: ModerationQueue[\s\S]*?guards: \[requireAuth, requireChefAdmin\][\s\S]*?meta: \{ layout: AppShell \}/);
    // route outside the group has no layout/guard
    expect(code).toContain('{ path: "/login", handler: Login, paramsSchema: {}, priority: 50, guards: [], status: null, meta: {} }');
    // catch-all with status
    expect(code).toContain('{ path: "**", handler: NotFound, paramsSchema: {}, priority: 50, guards: [], status: 404, meta: {} }');
  });

  it('parses optional param with a default', () => {
    const src = `router R export
routes
"/list" -> List { page: int? default(1) }
end routes
end router
`;
    const { code } = compileDtx(src);
    expect(code).toContain('"page": { type: "int", optional: true, default: 1 }');
  });

  it('supports layout+guard on a single route line (clauses before ->)', () => {
    const src = `router R export
routes
"/kitchen/:recipeId" layout=KitchenShell guard=requireAuth -> KitchenMode { recipeId: string }
end routes
end router
`;
    const { code } = compileDtx(src);
    expect(code).toMatch(/handler: KitchenMode[\s\S]*?guards: \[requireAuth\][\s\S]*?meta: \{ layout: KitchenShell \}/);
    expect(code).toContain('"recipeId": { type: "string", optional: false }');
  });

  it('emits default imports for handlers/layouts/guards referenced in routes (REQ-16)', () => {
    const src = `import Login from "pages.Login"
import Dashboard from "pages.Dashboard"
import AppShell from "layouts.AppShell"
import requireAuth from "lib.auth-guard"
import form, f from "uidetox/forms"

router AppRoutes export
routes
"/login" -> Login
group layout=AppShell guard=requireAuth
"/" -> Dashboard
end group
end routes
end router
`;
    const { code } = compileDtx(src);
    // handler / layout / guard → default imports (extension depends on baseDir/REQ-15)
    expect(code).toMatch(/import Login from "[^"]*pages\/Login[^"]*";/);
    expect(code).toMatch(/import Dashboard from "[^"]*pages\/Dashboard[^"]*";/);
    expect(code).toMatch(/import AppShell from "[^"]*layouts\/AppShell[^"]*";/);
    expect(code).toMatch(/import requireAuth from "[^"]*lib\/auth-guard[^"]*";/);
    // NOT named
    expect(code).not.toMatch(/import\s*\{\s*Login\s*\}\s*from/);
    // unrelated named imports stay named
    expect(code).toContain('import { form, f } from "uidetox/forms";');
    expect(code).toContain('handler: Login');
  });

  it('component modules default-export an element factory', () => {
    const src = `component AppCard tag app-card
template
<div class="card"><slot/></div>
end template
end component
`;
    const { code } = compileDtx(src);
    expect(code).toContain('export default () => document.createElement("app-card");');
  });
});
