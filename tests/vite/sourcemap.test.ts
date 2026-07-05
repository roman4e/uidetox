import { describe, expect, it } from 'vitest';
import { buildLineMap } from '../../src/vite/sourcemap.js';
import { compileModule } from '../../src/vite/compile.js';

const MD = `---
tag: hello-box
---

\`\`\`html template
<p>hi</p>
\`\`\`
`;

describe('buildLineMap', () => {
  it('produces a valid v3 map with source content and per-line mappings', () => {
    const map = buildLineMap('X.md', 'a\nb\nc', 'g1\ng2\ng3\ng4');
    expect(map.version).toBe(3);
    expect(map.sources).toEqual(['X.md']);
    expect(map.sourcesContent[0]).toBe('a\nb\nc');
    expect(map.mappings.split(';').length).toBe(4); // one row per generated line
    expect(map.mappings.length).toBeGreaterThan(0);
  });
});

describe('compileModule .md source map (§9.5)', () => {
  it('returns a non-null v3 source map for .md', () => {
    const m = compileModule('Hello.md', MD);
    expect(m.map).not.toBeNull();
    const parsed = JSON.parse(m.map!);
    expect(parsed.version).toBe(3);
    expect(parsed.sources).toEqual(['Hello.md']);
    expect(parsed.sourcesContent[0]).toContain('hello-box');
  });
});
