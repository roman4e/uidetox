import { describe, expect, it } from 'vitest';
import { createToken, registry } from '../../src/runtime/registry.js';
import { flushSync } from '../../src/runtime/scheduler.js';

describe('Registry', () => {
  it('resolves a globally-provided value', () => {
    const token = createToken<string>('greeting');
    registry.provide(token, 'hello');
    expect(registry.get(token).value).toBe('hello');
  });

  it('follows a scope override during scope.enter()', () => {
    const token = createToken<string>('color');
    registry.provide(token, 'red');
    const scope = registry.createScope();
    scope.override(token, 'blue');
    scope.enter(() => {
      expect(registry.get(token).value).toBe('blue');
    });
    expect(registry.get(token).value).toBe('red');
  });

  it('re-evaluates the Derived when the provider changes', () => {
    const token = createToken<number>('n');
    registry.provide(token, () => 1);
    const d = registry.get(token);
    expect(d.value).toBe(1);
    registry.provide(token, () => 2);
    flushSync();
    expect(d.value).toBe(2);
  });
});
