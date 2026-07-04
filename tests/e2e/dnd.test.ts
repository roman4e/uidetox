import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileDtx } from '../../src/compiler/dtx/index.js';

const src = readFileSync(resolve(process.cwd(), 'examples/dnd/Palette.dtx'), 'utf8');

describe('dnd Palette example', () => {
  it('compiles draggable + droppable use= traits', () => {
    const { code } = compileDtx(src);
    expect(code).toContain('defineComponent');
    expect(code).toContain('__use(');
    expect(code).toContain("traitName: \"draggable\"");
    expect(code).toContain("traitName: \"droppable\"");
    expect(code).toContain("accept: ('ingredient')");
    expect(code).toContain('__for(');
  });
});
