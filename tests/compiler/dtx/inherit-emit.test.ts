import { describe, expect, it } from 'vitest';
import { compileDtx } from '../../../src/compiler/dtx/index.js';

describe('dtx inherit emit', () => {
  it('emits trait extends + off', () => {
    const src = `trait c extends [a, numeric-only] appliesto [input]
off blur trim_handler()
off blur *()
`;
    const { code } = compileDtx(src);
    expect(code).toContain('extends: [a, numericOnly]');
    expect(code).toContain("off: { 'blur': 'all' }");
  });

  it('emits filter extends + offTransform', () => {
    const src = `filter c extends [base] input string output string
off transform *()
`;
    const { code } = compileDtx(src);
    expect(code).toContain('extends: [base]');
    expect(code).toContain("offTransform: 'all'");
  });

  it('forwards token extends to createToken opts', () => {
    const src = `token admin-user extends [current-user] User\n`;
    const { code } = compileDtx(src);
    expect(code).toContain("createToken<User>('admin-user', { extends: [currentUser] })");
  });
});
