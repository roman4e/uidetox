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
    expect(code).toContain('import { Login } from "./pages/Login.js";');
    expect(code).toContain('export default [');
    expect(code).toContain('{ path: "/login", handler: Login, paramsSchema: {}, priority: 50, guards: [], status: null, meta: {} }');
    expect(code).toContain('{ path: "/", handler: Dashboard,');
  });

  it('parses param, guard, priority, status modifiers', () => {
    const src = `router R export
routes
"/users/:id" -> UserProfile param id number guard require-auth priority 10 status 200
end routes
end router
`;
    const { code } = compileDtx(src);
    expect(code).toContain('paramsSchema: { "id": { type: "number", optional: false } }');
    expect(code).toContain('guards: [requireAuth]');
    expect(code).toContain('priority: 10');
    expect(code).toContain('status: 200');
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
