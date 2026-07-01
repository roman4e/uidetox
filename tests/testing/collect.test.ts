import { describe, expect, it } from 'vitest';
import {
  beforeEach,
  describe as uDescribe,
  getCollectedTree,
  it as uIt,
} from '../../src/testing/collect.js';

describe('collect', () => {
  it('captures a tree of describe / it / beforeEach', () => {
    getCollectedTree(); // reset root
    uDescribe('outer', () => {
      beforeEach(() => {});
      uIt('a', () => {});
      uDescribe('inner', () => {
        uIt('b', () => {});
      });
    });
    const tree = getCollectedTree();
    expect(tree.suites[0].name).toBe('outer');
    expect(tree.suites[0].hooks.beforeEach).toHaveLength(1);
    expect(tree.suites[0].tests.map((t) => t.name)).toEqual(['a']);
    expect(tree.suites[0].suites[0].tests.map((t) => t.name)).toEqual(['b']);
  });
});
