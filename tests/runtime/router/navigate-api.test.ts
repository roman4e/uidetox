import { describe, expect, it, beforeEach } from 'vitest';
import { navigate, installNavLinks, setActiveController } from '../../../src/runtime/router/navigate-api.js';
import type { NavigateController } from '../../../src/runtime/router/navigate.js';

function fakeController(): NavigateController & { calls: Array<[string, unknown]> } {
  const calls: Array<[string, unknown]> = [];
  return {
    calls,
    current: () => ({ path: '/', search: '', hash: '', fullUrl: '/' }),
    goto: (url, opts) => { calls.push([url, opts]); },
    onChange: () => () => {},
  };
}

beforeEach(() => { setActiveController(null); document.body.innerHTML = ''; });

describe('navigate()', () => {
  it('routes through the active controller', () => {
    const c = fakeController();
    setActiveController(c);
    navigate('/recipes/5');
    expect(c.calls).toEqual([['/recipes/5', undefined]]);
  });

  it('throws when no router is active', () => {
    expect(() => navigate('/x')).toThrow(/no router is active/);
  });
});

describe('<a data-nav>', () => {
  it('intercepts a plain left click on a data-nav link', () => {
    const c = fakeController();
    setActiveController(c);
    installNavLinks();
    const a = document.createElement('a');
    a.setAttribute('data-nav', '');
    a.setAttribute('href', '/dashboard');
    document.body.appendChild(a);
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    a.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(c.calls).toEqual([['/dashboard', undefined]]);
  });

  it('ignores links without data-nav', () => {
    const c = fakeController();
    setActiveController(c);
    installNavLinks();
    const a = document.createElement('a');
    a.setAttribute('href', '/plain');
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    expect(c.calls).toEqual([]);
  });

  it('ignores modifier / middle clicks and target=_blank', () => {
    const c = fakeController();
    setActiveController(c);
    installNavLinks();
    const a = document.createElement('a');
    a.setAttribute('data-nav', '');
    a.setAttribute('href', '/x');
    a.target = '_blank';
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));       // _blank
    a.removeAttribute('target');
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true })); // cmd-click
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 1 }));         // middle
    expect(c.calls).toEqual([]);
  });
});
