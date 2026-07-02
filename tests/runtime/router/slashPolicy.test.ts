import { describe, expect, it } from 'vitest';
import { applySlashPolicy } from '../../../src/runtime/router/slashPolicy.js';

describe('applySlashPolicy()', () => {
  it('strict never rewrites', () => {
    expect(applySlashPolicy('strict', '/users', () => true)).toBeNull();
    expect(applySlashPolicy('strict', '/users/', () => true)).toBeNull();
  });

  it('narrowing strips trailing slash if that form matches', () => {
    expect(applySlashPolicy('narrowing', '/users/', (u) => u === '/users')).toEqual({ url: '/users' });
    expect(applySlashPolicy('narrowing', '/users/', () => false)).toBeNull();
  });

  it('narrowing skips root', () => {
    expect(applySlashPolicy('narrowing', '/', () => true)).toBeNull();
  });

  it('expanding adds trailing slash if that form matches', () => {
    expect(applySlashPolicy('expanding', '/users', (u) => u === '/users/')).toEqual({ url: '/users/' });
    expect(applySlashPolicy('expanding', '/users', () => false)).toBeNull();
  });
});
