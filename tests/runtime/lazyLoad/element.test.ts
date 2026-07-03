import { describe, expect, it } from 'vitest';
import { registerLazyLoad } from '../../../src/runtime/lazyLoad/element.js';

function mount(attrs: Record<string, string>): HTMLElement {
  const el = document.createElement('lazy-load');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.replaceChildren(el);
  return el;
}

describe('<lazy-load>', () => {
  it('renders placeholder, then swaps to loaded factory output', async () => {
    const importer = async () => ({ default: () => {
      const el = document.createElement('span');
      el.textContent = 'loaded';
      return el;
    } });
    registerLazyLoad({ importer });

    const host = mount({ src: '/heavy.js', trigger: 'eager', placeholder: 'skeleton' });
    await new Promise((r) => setTimeout(r, 20));
    expect(host.querySelector('span')?.textContent).toBe('loaded');
  });

  it('fires load event on success', async () => {
    const importer = async () => ({ default: () => document.createTextNode('ok') });
    registerLazyLoad({ importer });
    const host = mount({ src: '/ok.js', trigger: 'eager' });
    let fired = false;
    host.addEventListener('load', () => { fired = true; });
    await new Promise((r) => setTimeout(r, 20));
    expect(fired).toBe(true);
  });

  it('fires error event on failure', async () => {
    const importer = async () => { throw new Error('boom'); };
    registerLazyLoad({ importer });
    const host = mount({ src: '/bad.js', trigger: 'eager' });
    let msg = '';
    host.addEventListener('error', (e) => { msg = (e as CustomEvent).detail?.message ?? ''; });
    await new Promise((r) => setTimeout(r, 20));
    expect(msg).toContain('boom');
  });
});
