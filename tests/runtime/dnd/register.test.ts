import { describe, expect, it, afterEach } from 'vitest';
import { registerDnd } from '../../../src/runtime/dnd/register.js';
import { clearTraitRegistry, getTrait } from '../../../src/runtime/traits/define.js';
import { installTraits } from '../../../src/runtime/traits/install.js';

afterEach(() => { clearTraitRegistry(); document.body.innerHTML = ''; });

function pev(type: string, opts: { x?: number; y?: number } = {}): Event {
  const e = new Event(type, { bubbles: true });
  Object.assign(e, { clientX: opts.x ?? 0, clientY: opts.y ?? 0, pointerType: 'mouse' });
  return e;
}

describe('registerDnd', () => {
  it('registers the four dnd traits', () => {
    registerDnd();
    expect(getTrait('draggable')).toBeDefined();
    expect(getTrait('droppable')).toBeDefined();
    expect(getTrait('sortable')).toBeDefined();
    expect(getTrait('sortable-item')).toBeDefined();
  });

  it('drives a full drag→drop via installed traits', () => {
    registerDnd();
    const source = document.createElement('li');
    source.dataset.payload = JSON.stringify({ kind: 'ingredient', id: 42 });
    const zone = document.createElement('div');
    document.body.append(source, zone);
    zone.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, x: 0, y: 0, toJSON() {},
    }) as DOMRect;

    const dispose1 = installTraits(source, new Map([[source, [{ traitName: 'draggable', params: { threshold: 4 } }]]]));
    const dispose2 = installTraits(zone, new Map([[zone, [{ traitName: 'droppable', params: { accept: 'ingredient' } }]]]));

    const drops: CustomEvent[] = [];
    zone.addEventListener('drop-payload', (e) => drops.push(e as CustomEvent));

    source.dispatchEvent(pev('pointerdown', { x: 0, y: 0 }));
    document.dispatchEvent(pev('pointermove', { x: 50, y: 50 }));
    document.dispatchEvent(pev('pointerup', { x: 50, y: 50 }));

    expect(drops).toHaveLength(1);
    expect((drops[0].detail.payload as { id: number }).id).toBe(42);
    dispose1();
    dispose2();
  });
});
