import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileDtx } from '../../src/compiler/dtx/index.js';

const src = readFileSync(
  resolve(process.cwd(), 'examples/forms/IngredientForm.dtx'),
  'utf8',
);

describe('IngredientForm example', () => {
  it('compiles the forms example .dtx end-to-end', () => {
    const { code } = compileDtx(src);
    expect(code).toContain('defineComponent');
    expect(code).toContain('from "uidetox/forms"');
    // bind attribute lowered to __bindField, array field via <for> + helpers
    expect(code).toContain('__bindField(');
    expect(code).toContain("fm.field('name')");
    expect(code).toContain('__for(');
    expect(code).toContain("append({ code: '', amountPer100g: 0 })");
  });
});
