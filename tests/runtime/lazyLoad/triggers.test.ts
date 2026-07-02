import { describe, expect, it } from 'vitest';
import { attachTrigger, schedulePrefetch } from '../../../src/runtime/lazyLoad/triggers.js';

describe('attachTrigger()', () => {
  it('eager fires on start', async () => {
    const el = document.createElement('div');
    let fired = 0;
    const handle = attachTrigger('eager', el, () => { fired++; });
    handle.start();
    await new Promise((r) => setTimeout(r, 5));
    expect(fired).toBe(1);
    handle.stop();
  });

  it('interaction fires on pointerenter', () => {
    const el = document.createElement('div');
    let fired = 0;
    const handle = attachTrigger('interaction', el, () => { fired++; });
    handle.start();
    el.dispatchEvent(new Event('pointerenter'));
    el.dispatchEvent(new Event('pointerenter'));
    expect(fired).toBe(1);
    handle.stop();
  });

  it('manual only fires when start explicitly triggered', () => {
    const el = document.createElement('div');
    let fired = 0;
    const handle = attachTrigger('manual', el, () => { fired++; });
    expect(fired).toBe(0);
    handle.start();
    setTimeout(() => {
      expect(fired).toBe(1);
      handle.stop();
    }, 5);
  });

  it('schedulePrefetch runs task asynchronously', async () => {
    let ran = false;
    schedulePrefetch(() => { ran = true; });
    await new Promise((r) => setTimeout(r, 10));
    expect(ran).toBe(true);
  });
});
