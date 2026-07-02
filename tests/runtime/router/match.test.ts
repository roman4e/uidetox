import { describe, expect, it } from 'vitest';
import { matchPath, specificity } from '../../../src/runtime/router/match.js';

describe('matchPath()', () => {
  it('matches static path exactly', () => {
    expect(matchPath('/', '/')).toEqual({ rawParams: {} });
    expect(matchPath('/', '')).toBeNull();
    expect(matchPath('/users', '/users')).toEqual({ rawParams: {} });
    expect(matchPath('/users', '/users/')).toBeNull();
    expect(matchPath('/users/', '/users/')).toEqual({ rawParams: {} });
  });

  it('captures single param', () => {
    expect(matchPath('/users/:id', '/users/42')).toEqual({ rawParams: { id: '42' } });
    expect(matchPath('/users/:id', '/users/')).toBeNull();
  });

  it('handles optional param', () => {
    expect(matchPath('/users/:id?', '/users')).toEqual({ rawParams: {} });
    expect(matchPath('/users/:id?', '/users/9')).toEqual({ rawParams: { id: '9' } });
  });

  it('captures catch-all', () => {
    expect(matchPath('/**', '/anything/here')).toEqual({ rawParams: {}, catchAll: 'anything/here' });
    expect(matchPath('/admin/**', '/admin')).toEqual({ rawParams: {}, catchAll: '' });
    expect(matchPath('/admin/**', '/admin/users/1')).toEqual({ rawParams: {}, catchAll: 'users/1' });
  });

  it('specificity ranks static > param > catchAll', () => {
    expect(specificity('/users/42')).toEqual([2, 2, 0]);
    expect(specificity('/users/:id')).toEqual([2, 1, 0]);
    expect(specificity('/users/**')).toEqual([2, 1, 1]);
    expect(specificity('/**')).toEqual([1, 0, 1]);
  });
});
