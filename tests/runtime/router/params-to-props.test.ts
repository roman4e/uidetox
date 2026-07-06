import { describe, expect, it, beforeEach } from 'vitest';
import { defineComponent } from '../../../src/runtime/component.js';
import { __el, __bind, __text } from '../../../src/runtime/domHelpers.js';
import { defineRouter } from '../../../src/runtime/router/define.js';
import { registerOutlet } from '../../../src/runtime/router/outlet.js';
import type { RouteEntry } from '../../../src/runtime/router/types.js';

// Emulates the compiler's param-aware default handler (REQ-18).
function paramHandler(tag: string) {
  return (ctx: { params?: Record<string, unknown> }) => {
    const el = document.createElement(tag) as HTMLElement & { __uidetoxParams?: unknown };
    if (ctx?.params) {
      el.__uidetoxParams = ctx.params;
      for (const [k, v] of Object.entries(ctx.params)) {
        if (v !== undefined && v !== null) el.setAttribute(k, String(v));
      }
    }
    return el;
  };
}

let bootId: unknown;
defineComponent({
  tag: 'page-id',
  props: ['id'],
  boot: (ctx) => {
    bootId = ctx.props.id;                                  // read at first evaluation
    return __el('div', [], [__bind(__text(''), 'text-content', '', () => String(ctx.props.id), ctx)], ctx);
  },
});

const tick = () => new Promise((r) => setTimeout(r, 0));
function route(paramsSchema: RouteEntry['paramsSchema']): RouteEntry {
  return { path: '/r/:id', handler: paramHandler('page-id'), paramsSchema, priority: 50, guards: [], status: null, meta: {} };
}

beforeEach(() => { document.body.innerHTML = ''; bootId = undefined; });

async function navigate(paramsSchema: RouteEntry['paramsSchema'], url: string) {
  registerOutlet();
  const router = defineRouter({ routes: [route(paramsSchema)], mode: 'hash' });
  const outlet = document.createElement('router-outlet') as HTMLElement & { __attach(r: unknown): void };
  document.body.appendChild(outlet);
  outlet.__attach(router);
  router.start();
  router.controller.goto(url);
  await tick(); await tick();
  return { outlet, router };
}

describe('router params → props (REQ-18)', () => {
  it('sets the attribute and populates props.id before boot (string)', async () => {
    const { outlet, router } = await navigate({ id: { type: 'string', optional: false } }, '/r/42');
    const el = outlet.querySelector('page-id')!;
    expect(el.getAttribute('id')).toBe('42');
    expect(bootId).toBe('42');
    router.stop();
  });

  it('coerces number params (props.id is a number at boot)', async () => {
    const { router } = await navigate({ id: { type: 'number', optional: false } }, '/r/42');
    expect(bootId).toBe(42);           // number, not "42"
    expect(typeof bootId).toBe('number');
    router.stop();
  });
});
