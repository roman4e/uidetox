import { describe, expect, it } from 'vitest';
import { defineRouter } from '../../../src/runtime/router/define.js';
import type { RouteEntry } from '../../../src/runtime/router/types.js';

const HomeHandler = () => document.createTextNode('home');
const UserHandler = () => document.createTextNode('user');

function fakeRoutes(): RouteEntry[] {
  return [
    { path: '/',           handler: HomeHandler, paramsSchema: {},                          priority: 50, guards: [], status: null, meta: {} },
    { path: '/users/:id',  handler: UserHandler, paramsSchema: { id: { type: 'number', optional: false } }, priority: 50, guards: [], status: null, meta: {} },
  ];
}

describe('defineRouter()', () => {
  it('matches root and fires onMatched', async () => {
    history.replaceState(null, '', '/');
    const router = defineRouter({ routes: fakeRoutes() });
    router.start();
    let matched: string | null = null;
    router.onMatched((m) => { matched = m.entry.path; });
    router.controller.goto('/');
    await Promise.resolve();
    expect(matched).toBe('/');
    router.stop();
  });

  it('coerces params', async () => {
    history.replaceState(null, '', '/');
    const router = defineRouter({ routes: fakeRoutes() });
    let matched: { path: string; id: unknown } | null = null;
    router.start();
    router.onMatched((m) => { matched = { path: m.entry.path, id: m.params.id }; });
    router.controller.goto('/users/42');
    await Promise.resolve();
    expect(matched).toEqual({ path: '/users/:id', id: 42 });
    router.stop();
  });
});
