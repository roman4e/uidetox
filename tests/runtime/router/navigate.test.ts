import { describe, expect, it } from 'vitest';
import { createController } from '../../../src/runtime/router/navigate.js';

describe('createController()', () => {
  it('history mode reads and mutates path', () => {
    history.replaceState(null, '', '/');
    const c = createController('history');
    expect(c.current().path).toBe('/');
    c.goto('/users/1');
    expect(c.current().path).toBe('/users/1');
  });

  it('history mode fires listeners on goto', () => {
    history.replaceState(null, '', '/');
    const c = createController('history');
    let called: string | null = null;
    c.onChange((loc) => { called = loc.path; });
    c.goto('/x');
    expect(called).toBe('/x');
  });

  it('hash mode strips leading #', () => {
    location.hash = '';
    const c = createController('hash');
    expect(c.current().path).toBe('/');
    c.goto('/foo');
    expect(location.hash).toBe('#/foo');
    expect(c.current().path).toBe('/foo');
  });
});
