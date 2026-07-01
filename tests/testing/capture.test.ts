import { describe, expect, it } from 'vitest';
import { capture } from '../../src/testing/capture.js';

describe('capture()', () => {
  it('collects detail payloads from CustomEvents', () => {
    const el = document.createElement('div');
    const events = capture<{ n: number }>(el, 'ping');
    el.dispatchEvent(new CustomEvent('ping', { detail: { n: 1 } }));
    el.dispatchEvent(new CustomEvent('ping', { detail: { n: 2 } }));
    expect(events).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('collects raw events when there is no detail', () => {
    const el = document.createElement('div');
    const events = capture<Event>(el, 'click');
    el.dispatchEvent(new Event('click'));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('click');
  });
});
