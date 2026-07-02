import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { discoverRoutes } from '../../src/compiler/routes/collect.js';
import { emitRoutesModule } from '../../src/compiler/routes/codegen.js';
import { defineRouter, registerOutlet } from '../../src/runtime/index.js';
import type { RouteEntry } from '../../src/runtime/index.js';

function evalRoutesModule(js: string, handlers: Record<string, () => Node>): RouteEntry[] {
  const stripped = js
    .replace(/^import\s.+?;\s*/gm, '')
    .replace(/^export\s+/gm, '');
  const fn = new Function(...Object.keys(handlers), `${stripped}\nreturn routes;`);
  return fn(...Object.values(handlers)) as RouteEntry[];
}

describe('routing basic', () => {
  it('renders route handler output through <router-outlet>', { timeout: 15000 }, async () => {
    const dir = join(process.cwd(), 'examples/routing');
    const discovered = await discoverRoutes(dir);
    const js = emitRoutesModule(discovered);
    const handlers = {
      Home: () => document.createTextNode('home'),
      UsersList: () => document.createTextNode('users-list'),
      UserProfile: () => {
        const el = document.createElement('span');
        el.dataset.role = 'user-profile';
        return el;
      },
      NotFound: () => document.createTextNode('not-found'),
    };
    const routes = evalRoutesModule(js, handlers);

    registerOutlet();
    history.replaceState(null, '', '/');
    document.body.innerHTML = '<router-outlet></router-outlet>';
    const outlet = document.body.querySelector('router-outlet') as HTMLElement & {
      __attach: (r: ReturnType<typeof defineRouter>) => void;
    };

    const router = defineRouter({ routes, slashPolicy: 'narrowing' });
    outlet.__attach(router);
    router.start();
    await new Promise((r) => setTimeout(r, 0));
    expect(outlet.textContent).toBe('home');

    router.controller.goto('/users/');
    await new Promise((r) => setTimeout(r, 0));
    expect(outlet.textContent).toBe('users-list');

    router.controller.goto('/users/42');
    await new Promise((r) => setTimeout(r, 0));
    expect(outlet.querySelector('span[data-role="user-profile"]')).not.toBeNull();

    router.controller.goto('/unknown/path');
    await new Promise((r) => setTimeout(r, 0));
    expect(outlet.textContent).toBe('not-found');
    router.stop();
  });
});
