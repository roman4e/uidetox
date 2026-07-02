import { describe, expect, it, vi } from 'vitest';
import { createLoaderCache } from '../../../src/runtime/lazyLoad/loader.js';

describe('createLoaderCache()', () => {
  it('dedupes concurrent loads', async () => {
    const importer = vi.fn(async (url: string) => ({ url }));
    const cache = createLoaderCache(importer);
    const [a, b] = await Promise.all([cache.load('/x'), cache.load('/x')]);
    expect(a).toBe(b);
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('retries after clear()', async () => {
    const importer = vi.fn(async () => ({}));
    const cache = createLoaderCache(importer);
    await cache.load('/y');
    cache.clear();
    await cache.load('/y');
    expect(importer).toHaveBeenCalledTimes(2);
  });
});
