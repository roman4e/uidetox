import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseSfc } from '../../src/compiler/sfc.js';
import { parseTemplate } from '../../src/compiler/template/parse.js';
import { resolveIncludes } from '../../src/compiler/template/include.js';

describe('include-basic e2e', () => {
  it('resolves include partial into the AST', () => {
    const filePath = join(process.cwd(), 'examples/include/pages/Home.md');
    const source = readFileSync(filePath, 'utf8');
    const sfc = parseSfc(source);
    const tpl = sfc.blocks.find((b) => b.role === 'template')!;
    const ast = parseTemplate(tpl.content);
    const resolved = resolveIncludes(ast, dirname(filePath));

    const main = resolved[0] as { children: Array<{ tag?: string; children?: Array<{ tag?: string; children?: Array<{ value?: string }> }> }> };
    const header = main.children.find((c) => c.tag === 'header')!;
    const h1 = header.children!.find((c) => c.tag === 'h1')!;
    expect(h1.children?.[0]?.value).toContain('Included Site');
  });
});
