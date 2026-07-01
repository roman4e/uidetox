import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discover } from '../../src/cli/testRunner/discover.js';

const SFC = `---
name: Todo
tag: app-todo
---

\`\`\`html template
<span>hi</span>
\`\`\`

\`\`\`ts test
it('ok', () => { expect(1).toBe(1); });
\`\`\`
`;

describe('discover()', () => {
  it('writes test modules for SFCs that contain test blocks', async () => {
    const root = mkdtempSync(join(tmpdir(), 'uidetox-disco-'));
    const src = join(root, 'src');
    const cache = join(root, 'cache');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'Todo.md'), SFC);
    writeFileSync(join(src, 'Other.md'), '---\nname: Other\ntag: app-other\n---\n\n```html template\n<i/>\n```\n');
    const result = await discover(src, cache);
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0].kind).toBe('happy-dom');
    expect(result.modules[0].sfcPath).toContain('Todo.md');
    expect(result.modules[0].cachePath).toContain('.happy-dom.test.mjs');
  });
});
