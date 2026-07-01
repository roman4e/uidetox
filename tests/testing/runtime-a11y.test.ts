import { describe, expect, it } from 'vitest';
import { axe } from '../../src/testing/a11y/runtime.js';

describe('runtime axe()', () => {
  it('returns violations shape from accessible markup', async () => {
    document.body.innerHTML = '<main><h1>Hello</h1><p>ok</p></main>';
    const result = await axe(document.body);
    expect(Array.isArray(result.violations)).toBeTruthy();
  });
});
