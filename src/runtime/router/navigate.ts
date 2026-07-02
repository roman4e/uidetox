import type { Location } from './types.js';

export interface NavigateController {
  current(): Location;
  goto(url: string, opts?: { replace?: boolean }): void;
  onChange(fn: (loc: Location) => void): () => void;
}

function parseUrl(url: string): { path: string; search: string; hash: string } {
  const hashIdx = url.indexOf('#');
  const hash = hashIdx >= 0 ? url.slice(hashIdx) : '';
  const noHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const searchIdx = noHash.indexOf('?');
  const search = searchIdx >= 0 ? noHash.slice(searchIdx) : '';
  const path = (searchIdx >= 0 ? noHash.slice(0, searchIdx) : noHash) || '/';
  return { path, search, hash };
}

export function createController(mode: 'history' | 'hash'): NavigateController {
  const listeners = new Set<(loc: Location) => void>();
  const initial =
    mode === 'history'
      ? { path: window.location.pathname || '/', search: window.location.search, hash: window.location.hash }
      : parseUrl(window.location.hash.replace(/^#/, '') || '/');
  let current: Location = { ...initial, fullUrl: window.location.href };

  const notify = () => {
    for (const fn of [...listeners]) fn(current);
  };

  const onPopState = () => {
    if (mode === 'history') {
      current = {
        path: window.location.pathname || '/',
        search: window.location.search,
        hash: window.location.hash,
        fullUrl: window.location.href,
      };
    } else {
      const raw = window.location.hash.replace(/^#/, '') || '/';
      const parsed = parseUrl(raw);
      current = { ...parsed, fullUrl: window.location.href };
    }
    notify();
  };
  window.addEventListener('popstate', onPopState);
  if (mode === 'hash') window.addEventListener('hashchange', onPopState);

  return {
    current: () => current,
    goto(url, opts) {
      const parsed = parseUrl(url);
      current = { ...parsed, fullUrl: url };
      if (mode === 'history') {
        const method: 'pushState' | 'replaceState' = opts?.replace ? 'replaceState' : 'pushState';
        try {
          window.history[method](null, '', url);
        } catch {
          /* happy-dom may reject in tests; internal state still updated */
        }
      } else {
        window.location.hash = `#${url}`;
      }
      notify();
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
