import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../src/runtime/index.js';

describe('island wrapper e2e', () => {
  it('runs onMount teardown on disconnect (raf-loop shape)', () => {
    const log: string[] = [];
    defineComponent({
      tag: 'island-clock',
      render: 'never',
      boot: (ctx) => {
        const canvas = document.createElement('canvas');
        ctx.refs.face = canvas;
        return canvas;
      },
      onMount: (ctx) => {
        expect((ctx.refs.face as HTMLElement).tagName.toLowerCase()).toBe('canvas');
        log.push('start-loop');
        return () => log.push('cancel-loop');
      },
    });
    document.body.innerHTML = '<island-clock size="120"></island-clock>';
    const el = document.body.querySelector('island-clock')!;
    expect(log).toEqual(['start-loop']);
    el.remove();
    expect(log).toEqual(['start-loop', 'cancel-loop']);
  });
});
