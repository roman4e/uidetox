import { describe, expect, it } from 'vitest';
import { compileDtx } from '../../../src/compiler/dtx/index.js';

describe('compileDtx()', () => {
  it('emits a trait as defineTrait call', () => {
    const src = `trait trim export appliesto [input, textarea] params (string? savedKey)
.saved_at = 0
on blur trim_handler() {
  this.el.value = this.el.value.trim();
}
`;
    const { code } = compileDtx(src);
    expect(code).toContain('import { defineTrait } from "uidetox";');
    expect(code).toContain('export const trim = defineTrait("trim", {');
    expect(code).toContain('appliesTo: ["input", "textarea"]');
    expect(code).toContain('paramsSchema: { savedKey');
    expect(code).toContain('handlers: {');
    expect(code).toContain('this.el.value.trim()');
  });

  it('emits a filter transform', () => {
    const src = `filter lowercase export input string output string
transform lc() { return v.toLowerCase(); }
`;
    const { code } = compileDtx(src);
    expect(code).toContain('import { defineFilter } from "uidetox";');
    expect(code).toContain('export const lowercase = defineFilter("lowercase", {');
    expect(code).toContain('return v.toLowerCase()');
  });

  it('emits imports with rename', () => {
    const src = `import trim, numeric-only as num from "./x.dtx"
`;
    const { code } = compileDtx(src);
    expect(code).toContain('import { trim, numericOnly as num } from "./x.dtx";');
  });
});
