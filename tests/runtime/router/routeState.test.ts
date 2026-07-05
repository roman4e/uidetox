import { describe, expect, it } from 'vitest';
import { defineRouter } from '../../../src/runtime/router/define.js';
import { routeState } from '../../../src/runtime/router/navigate-api.js';
import { effect } from '../../../src/runtime/effect.js';
import { flushSync } from '../../../src/runtime/scheduler.js';
import type { RouteEntry } from '../../../src/runtime/router/types.js';

function entry(path: string, meta: Record<string, unknown> = {}): RouteEntry {
  return { path, handler: () => document.createElement('div'), paramsSchema: path.includes(':') ? { id: { type: 'string', optional: false } } : {}, priority: 50, guards: [], status: null, meta };
}

describe('router reactive routeState (§11.11)', () => {
  it('updates path/params/meta on navigation and re-runs effects', async () => {
    const router = defineRouter({
      routes: [entry('/'), entry('/recipes/:id', { layout: 'AppShell' })],
      mode: 'hash',
    });
    router.start();
    await Promise.resolve();

    const seen: string[] = [];
    effect(() => { seen.push(router.state.path); });
    expect(seen.at(-1)).toBe('/');

    router.controller.goto('/recipes/42');
    await Promise.resolve();
    flushSync();
    expect(router.state.path).toBe('/recipes/:id');
    expect(router.state.params).toEqual({ id: '42' });
    expect(router.state.meta).toEqual({ layout: 'AppShell' });
    expect(seen).toContain('/recipes/:id'); // effect re-ran

    router.stop();
  });

  it('routeState() resolves the active router store; throws when none', () => {
    const router = defineRouter({ routes: [entry('/')], mode: 'hash' });
    router.start();
    expect(routeState()).toBe(router.state);
    router.stop();
    expect(() => routeState()).toThrow(/no router is active/);
  });
});
