import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../src/runtime/component.js';
import { resource } from '../../src/http/resource.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('resource auto-abort on unmount', () => {
  it('aborts the in-flight request when the host disconnects', async () => {
    let captured: AbortSignal | undefined;
    defineComponent({
      tag: 'res-host',
      boot: () => {
        resource(async (signal) => { captured = signal; await tick(); return 1; });
        return document.createTextNode('');
      },
    });
    const el = document.createElement('res-host');
    document.body.appendChild(el);
    expect(captured).toBeDefined();
    expect(captured!.aborted).toBe(false);
    el.remove();
    expect(captured!.aborted).toBe(true);
  });
});
