import { describe, expect, it } from 'vitest';
import { defineRouter } from '../../../src/runtime/router/define.js';
import { registerOutlet } from '../../../src/runtime/router/outlet.js';
import type { RouteEntry } from '../../../src/runtime/router/types.js';

const Home = () => {
  const el = document.createElement('div');
  el.textContent = 'home';
  return el;
};
const User = () => {
  const el = document.createElement('div');
  el.textContent = 'user';
  return el;
};

const routes: RouteEntry[] = [
  { path: '/',           handler: Home, paramsSchema: {},                          priority: 50, guards: [], status: null, meta: {} },
  { path: '/users/:id',  handler: User, paramsSchema: { id: { type: 'number', optional: false } }, priority: 50, guards: [], status: null, meta: {} },
];

describe('<router-outlet>', () => {
  it('renders handler output and swaps on navigation', async () => {
    registerOutlet();
    history.replaceState(null, '', '/');

    const router = defineRouter({ routes });
    document.body.innerHTML = '<router-outlet></router-outlet>';
    const outlet = document.body.querySelector('router-outlet')!;
    (outlet as HTMLElement & { __attach: (r: ReturnType<typeof defineRouter>) => void }).__attach(router);

    router.start();
    await new Promise((r) => setTimeout(r, 0));
    expect(outlet.textContent).toBe('home');

    router.controller.goto('/users/9');
    await new Promise((r) => setTimeout(r, 0));
    expect(outlet.textContent).toBe('user');
    router.stop();
  });
});
