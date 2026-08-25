import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { enter, exit, stagger, presence } from '../../../src/runtime/anim/enter.js';

// Force the reduced-motion path so animate() applies final styles synchronously
// and returns null — deterministic assertions without a real WAAPI clock.
const origMatchMedia = globalThis.matchMedia;
beforeEach(() => {
  (globalThis as { matchMedia: unknown }).matchMedia = () => ({ matches: true });
});
afterEach(() => {
  (globalThis as { matchMedia: unknown }).matchMedia = origMatchMedia;
});

const div = (): HTMLElement => document.createElement('div');

describe('enter()', () => {
  it('lands on the final styles (reduced motion applies instantly)', () => {
    const el = div();
    const anim = enter(el, { y: 20 });
    expect(anim).toBeNull();
    expect(el.style.opacity).toBe('1');
    expect(el.style.transform).toBe('none');
  });
});

describe('exit()', () => {
  it('resolves immediately under reduced motion', async () => {
    const el = div();
    await expect(exit(el)).resolves.toBeUndefined();
  });
});

describe('stagger()', () => {
  it('enters every element', () => {
    const els = [div(), div(), div()];
    const anims = stagger(els, { y: 10 }, 50);
    expect(anims).toHaveLength(3);
    for (const el of els) expect(el.style.opacity).toBe('1');
  });
});

describe('presence()', () => {
  it('runs swap after exit and enters the incoming node (mode="wait")', async () => {
    const outgoing = div();
    const order: string[] = [];
    const incoming = div();
    const result = await presence(outgoing, () => {
      order.push('swap');
      return incoming;
    });
    expect(order).toEqual(['swap']);
    expect(result).toBe(incoming);
    expect(incoming.style.opacity).toBe('1');
  });

  it('tolerates a null outgoing node', async () => {
    const incoming = div();
    const result = await presence(null, () => incoming);
    expect(result).toBe(incoming);
  });
});
