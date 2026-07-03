import { describe, expect, it } from 'vitest';
import { compileDtx } from '../../src/compiler/dtx/index.js';

describe('dtx inheritance e2e', () => {
  it('compiles a trait that extends another and applies off', () => {
    const src = `trait base export appliesto [input]
on blur base_handler() { this.el.dataset.base = '1'; }
trait child export extends [base] appliesto [input]
off blur base_handler()
on blur child_handler() { this.el.dataset.child = '1'; }
`;
    const { code } = compileDtx(src);
    expect(code).toContain('extends: [base]');
    expect(code).toContain("off: { 'blur':");
    expect(code).toContain('base_handler');
    expect(code).toContain('child_handler');
  });
});
