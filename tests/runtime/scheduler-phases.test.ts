import { describe, expect, it } from 'vitest';
import {
  flushSync,
  nextFrame,
  onFrameEnd,
  scheduleDerivation,
  scheduleEffect,
  scheduleRender,
} from '../../src/runtime/scheduler.js';

describe('phase ordering', () => {
  it('drains derivations, then effects, then renders', () => {
    const order: string[] = [];
    scheduleRender(() => order.push('r'));
    scheduleEffect(() => order.push('e'));
    scheduleDerivation(() => order.push('d'));
    flushSync();
    expect(order).toEqual(['d', 'e', 'r']);
  });

  it('re-turns when earlier queue is fed by later one', () => {
    const order: string[] = [];
    scheduleEffect(() => {
      order.push('e1');
      scheduleDerivation(() => order.push('d-late'));
    });
    flushSync();
    expect(order).toEqual(['e1', 'd-late']);
  });

  it('onFrameEnd fires after full drain', () => {
    const order: string[] = [];
    scheduleEffect(() => order.push('e'));
    scheduleRender(() => order.push('r'));
    onFrameEnd(() => order.push('end'));
    flushSync();
    expect(order).toEqual(['e', 'r', 'end']);
  });

  it('nextFrame resolves after drain', async () => {
    let seen = 'before';
    scheduleEffect(() => { seen = 'during'; });
    const p = nextFrame();
    flushSync();
    await p;
    expect(seen).toBe('during');
  });
});
