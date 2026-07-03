import { describe, expect, it } from 'vitest';
import { measure, measureOffscreen } from '../../../src/runtime/dom/measure.js';
import { mutate, readStaged } from '../../../src/runtime/dom/stage.js';

describe('measure()', () => {
  it('commits pending stage before reading', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    mutate(el, 'attr', 'data-x', 'staged');
    // before measure, staged not applied
    expect(el.getAttribute('data-x')).toBeNull();
    const seen = measure(() => el.getAttribute('data-x'));
    expect(seen).toBe('staged');
    // stage was flushed
    expect(readStaged(el, 'attr', 'data-x')).toBeUndefined();
  });
});

describe('measureOffscreen()', () => {
  it('measures a built node without leaving it in the document', () => {
    const before = document.body.childElementCount;
    const result = measureOffscreen(
      () => {
        const el = document.createElement('div');
        el.textContent = 'measure me';
        return el;
      },
      (el) => el.textContent,
    );
    expect(result).toBe('measure me');
    expect(document.body.childElementCount).toBe(before);
  });
});
