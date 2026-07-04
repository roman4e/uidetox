import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../src/runtime/component.js';
import { __el, __text } from '../../src/runtime/domHelpers.js';
import { flushSync } from '../../src/runtime/scheduler.js';
import { state } from '../../src/runtime/state.js';

describe('island lifecycle', () => {
  it('onMount runs after DOM built; cleanup runs on disconnect', () => {
    const events: string[] = [];
    defineComponent({
      tag: 'island-a',
      boot: (ctx) => __el('div', [['data-root', 'static', '']], [__text('ready')], ctx),
      onMount: (ctx) => {
        events.push('mount');
        // DOM already built — the root div is present
        expect(ctx.host.querySelector('[data-root]')).not.toBeNull();
        return () => events.push('cleanup');
      },
    });
    document.body.innerHTML = '<island-a></island-a>';
    const el = document.body.querySelector('island-a')!;
    expect(events).toEqual(['mount']);
    el.remove();
    expect(events).toEqual(['mount', 'cleanup']);
  });

  it('ctx.effect disposes on unmount — no run after removal', () => {
    const s = state({ n: 0 });
    const seen: number[] = [];
    defineComponent({
      tag: 'island-b',
      boot: (ctx) => {
        ctx.effect(() => { seen.push(s.n); });
        return __text('');
      },
    });
    document.body.innerHTML = '<island-b></island-b>';
    const el = document.body.querySelector('island-b')!;
    s.n = 1;
    flushSync();
    expect(seen).toEqual([0, 1]);
    el.remove();
    s.n = 2;
    flushSync();
    // effect disposed — did NOT run again
    expect(seen).toEqual([0, 1]);
  });

  it('ctx.emit dispatches a bubbling composed event', () => {
    let detail: unknown;
    defineComponent({
      tag: 'island-c',
      boot: (ctx) => {
        ctx.host.addEventListener('ping', (e) => { detail = (e as CustomEvent).detail; });
        ctx.emit('ping', { ok: true });
        return __text('');
      },
    });
    document.body.innerHTML = '<island-c></island-c>';
    expect(detail).toEqual({ ok: true });
  });

  it('ctx.registry is accessible', () => {
    let hasRegistry = false;
    defineComponent({
      tag: 'island-d',
      boot: (ctx) => {
        hasRegistry = typeof ctx.registry.get === 'function';
        return __text('');
      },
    });
    document.body.innerHTML = '<island-d></island-d>';
    expect(hasRegistry).toBe(true);
  });
});
