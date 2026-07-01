import { describe, expect, it } from 'vitest';
import { runInPlaywright } from '../../src/cli/testRunner/playwrightEnv.js';

describe('runInPlaywright()', () => {
  it('exposes a runner function that gracefully reports a missing browser', async () => {
    const originalEnv = process.env.PLAYWRIGHT_SKIP;
    process.env.PLAYWRIGHT_SKIP = '1';
    try {
      const result = await runInPlaywright('/nonexistent.mjs', '/tmp', false);
      expect(result.failed).toBe(1);
      expect(result.outcomes[0].error).toContain('PLAYWRIGHT_SKIP');
    } finally {
      if (originalEnv === undefined) delete process.env.PLAYWRIGHT_SKIP;
      else process.env.PLAYWRIGHT_SKIP = originalEnv;
    }
  });
});
