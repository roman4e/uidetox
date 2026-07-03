import { describe, expect, it } from 'vitest';
import { InconsistentHierarchyError, resolveLinearization } from '../../../src/runtime/mro/linearize.js';

interface Node { name: string; extends?: Node[]; }
function n(name: string, ext: Node[] = []): Node { return { name, extends: ext }; }

describe('resolveLinearization()', () => {
  it('returns [self] for a leaf', () => {
    const a = n('a');
    expect(resolveLinearization(a).map((x) => x.name)).toEqual(['a']);
  });

  it('single inheritance chain', () => {
    const a = n('a');
    const b = n('b', [a]);
    const c = n('c', [b]);
    expect(resolveLinearization(c).map((x) => x.name)).toEqual(['c', 'b', 'a']);
  });

  it('classic diamond', () => {
    const a = n('a');
    const b = n('b', [a]);
    const c = n('c', [a]);
    const d = n('d', [b, c]);
    expect(resolveLinearization(d).map((x) => x.name)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('throws on inconsistent hierarchy', () => {
    const x = n('x');
    const y = n('y');
    const a = n('a', [x, y]);
    const b = n('b', [y, x]);
    const c = n('c', [a, b]);
    expect(() => resolveLinearization(c)).toThrow(InconsistentHierarchyError);
  });

  it('caches result on the descriptor', () => {
    const a = n('a');
    const b = n('b', [a]);
    const first = resolveLinearization(b);
    const second = resolveLinearization(b);
    expect(second).toBe(first);
  });
});
