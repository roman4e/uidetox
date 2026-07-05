import { describe, expect, it } from 'vitest';
import { extractTestBlocks, emitTestExports } from '../../src/vite/testblocks.js';
import { createUidetoxCore } from '../../src/vite/plugin.js';

const MD = `---
tag: hello-box
---

\`\`\`html template
<p>hi</p>
\`\`\`

\`\`\`ts test
it('renders', () => { expect(1).toBe(1); });
\`\`\`

\`\`\`json fixtures
{ "sample": 1 }
\`\`\`
`;

describe('extractTestBlocks', () => {
  it('collects test + fixtures fences from .md', () => {
    const blocks = extractTestBlocks('/x/Hello.md', MD);
    expect(blocks.map((b) => b.role)).toEqual(['test', 'fixtures']);
    expect(blocks[0].body).toContain("it('renders'");
  });

  it('returns nothing for .dtx', () => {
    expect(extractTestBlocks('/x/A.dtx', 'component A tag a-b\n')).toEqual([]);
  });
});

describe('emitTestExports', () => {
  it('wraps test bodies in __tests()', () => {
    const js = emitTestExports(extractTestBlocks('/x/Hello.md', MD));
    expect(js).toContain('export function __tests()');
    expect(js).toContain('export const __fixtures =');
  });
});

describe('mode gating in the plugin', () => {
  it('dev/build strip test blocks', () => {
    const core = createUidetoxCore({ mode: 'build' });
    const out = core.transform(MD, '/x/Hello.md');
    expect(out?.code).not.toContain('__tests');
    expect(out?.code).not.toContain("it('renders'");
  });

  it('test mode re-emits __tests', () => {
    const core = createUidetoxCore({ mode: 'test' });
    const out = core.transform(MD, '/x/Hello.md');
    expect(out?.code).toContain('export function __tests()');
    expect(out?.code).toContain("it('renders'");
  });
});
