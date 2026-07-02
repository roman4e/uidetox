import { describe, expect, it } from 'vitest';
import { Redirect } from '../../../src/runtime/router/types.js';

describe('Redirect', () => {
  it('captures url and defaults replace=true', () => {
    const r = new Redirect('/login');
    expect(r.url).toBe('/login');
    expect(r.replace).toBe(true);
  });

  it('accepts replace override', () => {
    const r = new Redirect('/dashboard', false);
    expect(r.replace).toBe(false);
  });
});
