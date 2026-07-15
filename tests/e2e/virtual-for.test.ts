import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileDtx } from '../../src/compiler/dtx/index.js';

const src = readFileSync(
  resolve(process.cwd(), 'examples/virtual/IngredientList.dtx'),
  'utf8',
);

describe('IngredientList virtual-for example', () => {
  it('compiles <virtual-for> to __virtualFor with options', () => {
    const { code } = compileDtx(src);
    expect(code).toContain('defineComponent');
    expect(code).toContain('__virtualFor(() => (props.items)');
    expect(code).toContain('(ing, index) => (ing.id)');
    expect(code).toContain('rowHeight: (48)');
    expect(code).toContain('overscan: (6)');
    expect(code).toContain('import { __virtualFor } from "ui-detox"');
  });
});
