import { describe, expect, it, beforeEach } from 'vitest';
import { defineComponent } from '../../../src/runtime/component.js';
import { __el, __text } from '../../../src/runtime/domHelpers.js';
import { defineRouter } from '../../../src/runtime/router/define.js';
import { registerOutlet } from '../../../src/runtime/router/outlet.js';
import type { RouteEntry } from '../../../src/runtime/router/types.js';

// page + layout components
defineComponent({ tag: 'page-dash', boot: (ctx) => __el('section', [['class', 'static', 'page']], [__text('DASH')], ctx) });
defineComponent({
  tag: 'app-shell',
  boot: (ctx) => __el('div', [['class', 'static', 'shell']], [
    __el('header', [], [__text('nav')], ctx),
    __el('main', [], [__el('slot', [], [], ctx)], ctx),
  ], ctx),
});

const pageHandler = () => document.createElement('page-dash');
const layoutHandler = () => document.createElement('app-shell');

function entry(meta: Record<string, unknown>): RouteEntry {
  return { path: '/', handler: pageHandler, paramsSchema: {}, priority: 50, guards: [], status: null, meta };
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('router outlet meta.layout (REQ-17)', () => {
  it('wraps the page in its layout, projecting into the layout slot', async () => {
    registerOutlet();
    const router = defineRouter({ routes: [entry({ layout: layoutHandler })], mode: 'hash' });
    const outlet = document.createElement('router-outlet') as HTMLElement & { __attach(r: unknown): void };
    document.body.appendChild(outlet);
    outlet.__attach(router);
    router.start();
    await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));

    const shell = outlet.querySelector('app-shell');
    expect(shell).not.toBeNull();
    // page projected into the layout's <main> slot
    expect(shell!.querySelector('main > page-dash .page')?.textContent).toBe('DASH');
    router.stop();
  });

  it('renders the page directly when no layout', async () => {
    registerOutlet();
    const router = defineRouter({ routes: [entry({})], mode: 'hash' });
    const outlet = document.createElement('router-outlet') as HTMLElement & { __attach(r: unknown): void };
    document.body.appendChild(outlet);
    outlet.__attach(router);
    router.start();
    await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));

    expect(outlet.querySelector('app-shell')).toBeNull();
    expect(outlet.querySelector('page-dash .page')?.textContent).toBe('DASH');
    router.stop();
  });
});
