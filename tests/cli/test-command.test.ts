import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTest } from '../../src/cli/test.js';

const PASS = `---
name: Ok
tag: x-ok
---

\`\`\`html template
<span>hi</span>
\`\`\`

\`\`\`ts test
it('passes', () => { expect(1).toBe(1); });
\`\`\`
`;

const FAIL = `---
name: Fail
tag: x-fail
---

\`\`\`html template
<span>hi</span>
\`\`\`

\`\`\`ts test
it('fails', () => { expect(1).toBe(2); });
\`\`\`
`;

describe('runTest()', () => {
  it('runs happy-dom test blocks across an input directory', async () => {
    const root = mkdtempSync(join(tmpdir(), 'uidetox-cli-'));
    const src = join(root, 'src');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'Ok.md'), PASS);
    writeFileSync(join(src, 'Fail.md'), FAIL);
    const result = await runTest({
      inputDir: src,
      cacheDir: join(root, 'cache'),
      snapshotsDir: join(root, 'snap'),
    });
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.report).toContain('Ok.md');
    expect(result.report).toContain('Fail.md');
  });
});
