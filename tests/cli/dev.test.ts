import { describe, expect, it } from 'vitest';
import { program } from '../../src/cli/build.js';

describe('uidetox CLI', () => {
  it('registers dev + test commands alongside build + openapi', () => {
    const names = program.commands.map((c) => c.name()).sort();
    expect(names).toEqual(['build', 'dev', 'openapi', 'test']);
  });
});
