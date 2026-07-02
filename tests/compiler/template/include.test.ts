import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseTemplate } from '../../../src/compiler/template/parse.js';
import { resolveIncludes } from '../../../src/compiler/template/include.js';

describe('resolveIncludes()', () => {
  it('inlines an .html partial', () => {
    const dir = mkdtempSync(join(tmpdir(), 'inc-'));
    writeFileSync(join(dir, 'header.html'), '<header><h1>Site</h1></header>');
    const ast = parseTemplate('<main><include src="./header.html"/><p>body</p></main>');
    const resolved = resolveIncludes(ast, dir);
    const main = resolved[0] as { children: Array<{ tag?: string; children?: Array<{ tag?: string }> }> };
    expect(main.children[0].tag).toBe('header');
    expect(main.children[1].tag).toBe('p');
  });

  it('inlines an .md template block', () => {
    const dir = mkdtempSync(join(tmpdir(), 'inc-'));
    const sfc = `---
name: Nav
tag: app-nav
---

\`\`\`html template
<nav><a href="/">Home</a></nav>
\`\`\`
`;
    writeFileSync(join(dir, 'nav.md'), sfc);
    const ast = parseTemplate('<div><include src="./nav.md"/></div>');
    const resolved = resolveIncludes(ast, dir);
    const div = resolved[0] as { children: Array<{ tag?: string }> };
    expect(div.children[0].tag).toBe('nav');
  });

  it('throws on cycle', () => {
    const dir = mkdtempSync(join(tmpdir(), 'inc-'));
    writeFileSync(join(dir, 'a.html'), '<include src="./b.html"/>');
    writeFileSync(join(dir, 'b.html'), '<include src="./a.html"/>');
    const ast = parseTemplate('<include src="./a.html"/>');
    expect(() => resolveIncludes(ast, dir)).toThrow(/cycle/i);
  });

  it('errors on missing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'inc-'));
    const ast = parseTemplate('<include src="./nope.html"/>');
    expect(() => resolveIncludes(ast, dir)).toThrow();
  });
});
