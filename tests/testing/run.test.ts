import { describe, expect, it as vit } from 'vitest';
import { beforeEach, describe as uDescribe, getCollectedTree, it } from '../../src/testing/collect.js';
import { runTree } from '../../src/testing/run.js';

describe('runTree', () => {
  vit('runs each test and reports passes / failures', async () => {
    getCollectedTree();
    uDescribe('math', () => {
      let x = 0;
      beforeEach(() => { x = 1; });
      it('adds', () => { if (x + 1 !== 2) throw new Error('bad math'); });
      it('breaks', () => { throw new Error('boom'); });
    });
    const result = await runTree(getCollectedTree());
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.outcomes.map((o) => o.path)).toEqual(['math > adds', 'math > breaks']);
    expect(result.outcomes[1].error).toContain('boom');
  });
});
