import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from '../../src/compiler/compile.js';
import { compileDtx } from '../../src/compiler/dtx/index.js';
import { extractDoc, renderDocPage } from '../../src/compiler/docs/generate.js';

describe('showcase e2e', () => {
  it('compiles the Home.md component', () => {
    const src = readFileSync(join(process.cwd(), 'examples/showcase/pages/Home.md'), 'utf8');
    const { js, tag } = compile(src);
    expect(tag).toBe('page-home');
    expect(js).toContain('defineComponent');
  });

  it('compiles the inputs.dtx trait file with inheritance', () => {
    const src = readFileSync(join(process.cwd(), 'examples/showcase/traits/inputs.dtx'), 'utf8');
    const { code } = compileDtx(src);
    expect(code).toContain("defineTrait('trim'");
    expect(code).toContain("defineTrait('uppercase'");
    expect(code).toContain('extends: [trim]');
  });

  it('compiles the text.dtx filter file with inheritance', () => {
    const src = readFileSync(join(process.cwd(), 'examples/showcase/filters/text.dtx'), 'utf8');
    const { code } = compileDtx(src);
    expect(code).toContain("defineFilter('lowercase'");
    expect(code).toContain("defineFilter('title-case'");
    expect(code).toContain('extends: [lowercase]');
  });

  it('renders a docs page from Home.md', () => {
    const src = readFileSync(join(process.cwd(), 'examples/showcase/pages/Home.md'), 'utf8');
    const doc = extractDoc(src);
    expect(doc.tag).toBe('page-home');
    expect(doc.examples.map((e) => e.label)).toContain('basic');
    const html = renderDocPage(doc);
    expect(html).toContain('page-home');
    expect(html).toContain('basic');
  });
});
