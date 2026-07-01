import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTest } from '../../src/cli/test.js';

describe('phase 1a e2e — todo', () => {
  it('runs green through the CLI', { timeout: 20000 }, async () => {
    const root = mkdtempSync(join(tmpdir(), 'uidetox-p1a-'));
    const cache = join(root, 'cache');
    const snap = join(root, 'snap');
    const result = await runTest({
      inputDir: join(process.cwd(), 'examples/todo'),
      cacheDir: cache,
      snapshotsDir: snap,
      updateSnapshots: true,
    });
    expect(result.failed).toBe(0);
    expect(result.passed).toBeGreaterThan(0);
  });
});
