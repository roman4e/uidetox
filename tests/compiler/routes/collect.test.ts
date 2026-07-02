import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverRoutes } from '../../../src/compiler/routes/collect.js';

const ROUTES_MD = `---
name: AppRoutes
---

\`\`\`ts script
import Home from './pages/Home.md';
import UsersList from './pages/UsersList.md';
\`\`\`

\`\`\`html template
<Router>
  <Route path="/" to="\${Home}"/>
  <Route path="/users/" to="\${UsersList}"/>
</Router>
\`\`\`
`;

describe('discoverRoutes()', () => {
  it('parses a routes.md file into RouterAst array', async () => {
    const root = mkdtempSync(join(tmpdir(), 'uidetox-routes-'));
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'routes.md'), ROUTES_MD);

    const results = await discoverRoutes(root);
    expect(results).toHaveLength(1);
    expect(results[0].routers).toHaveLength(1);
    expect(results[0].routers[0].routes.map((r) => r.path)).toEqual(['/', '/users/']);
    expect(results[0].imports).toContain("import Home from './pages/Home.md';");
    expect(results[0].imports).toContain("import UsersList from './pages/UsersList.md';");
  });
});
