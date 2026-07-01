import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runBuild } from '../../src/cli/build.js';

const SFC = `---
name: Hello
tag: x-hello
---

\`\`\`html template
<span>hi</span>
\`\`\`
`;

describe('runBuild()', () => {
  it('compiles each .md under inputDir and writes a matching .js under outDir', async () => {
    const root = mkdtempSync(join(tmpdir(), 'uidetox-build-'));
    const src = join(root, 'src');
    const out = join(root, 'out');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'Hello.md'), SFC);

    await runBuild({ inputDir: src, outDir: out });

    const compiled = readFileSync(join(out, 'Hello.js'), 'utf8');
    expect(compiled).toContain('defineComponent(');
    expect(compiled).toContain('tag: "x-hello"');
  });
});
