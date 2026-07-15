import { describe, expect, it } from 'vitest';
import { compileDtxSource } from '../../../src/compiler/dtx/emit.js';

const count = (code: string, re: RegExp) => (code.match(re) ?? []).length;

describe('dtx auto-imports module-level reactivity primitives', () => {
  const comp = (body: string, imports = '') =>
    `${imports}component X export tag x-y\nscript\n${body}\nend script\ntemplate\n<div>hi</div>\nend template\nend component\n`;

  it('auto-imports state/derived when used but not imported', () => {
    const { code } = compileDtxSource(comp('const s = state({ a: 1 })\nconst d = derived(() => s.a)'));
    expect(count(code, /import \{ state \} from "ui-detox"/g)).toBe(1);
    expect(count(code, /import \{ derived \} from "ui-detox"/g)).toBe(1);
  });

  it('does not duplicate when the author already imports the primitive', () => {
    const { code } = compileDtxSource(comp('const s = state({ a: 1 })', 'import state from "ui-detox"\n'));
    expect(count(code, /import \{ state \} from "ui-detox"/g)).toBe(1);
  });

  it('does not import a primitive that is never called', () => {
    const { code } = compileDtxSource(comp('const x = 1'));
    expect(count(code, /import \{ (state|derived|batch|shallow) \} from "ui-detox"/g)).toBe(0);
  });

  it('does not false-positive on a local identifier that is not a call', () => {
    const { code } = compileDtxSource(comp('function f(state) { return state }'));
    expect(count(code, /import \{ state \} from "ui-detox"/g)).toBe(0);
  });
});
