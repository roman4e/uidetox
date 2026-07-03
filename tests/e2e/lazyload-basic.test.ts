import { describe, expect, it } from 'vitest';
import { registerLazyLoad } from '../../src/runtime/index.js';

function mount(attrs: Record<string, string>): HTMLElement {
  const el = document.createElement('lazy-load');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.replaceChildren(el);
  return el;
}

describe('lazyload-basic e2e', () => {
  it('renders placeholder, then loaded content on interaction', async () => {
    const importer = async () => ({ default: () => {
      const el = document.createElement('section');
      el.dataset.role = 'heavy';
      el.textContent = 'Heavy content';
      return el;
    } });
    registerLazyLoad({ importer });

    const host = mount({ src: '/Heavy.js', trigger: 'interaction', placeholder: 'my-skel' });

    expect(host.querySelector('my-skel')).not.toBeNull();
    expect(host.querySelector('section[data-role="heavy"]')).toBeNull();

    host.dispatchEvent(new Event('pointerenter'));
    await new Promise((r) => setTimeout(r, 20));

    expect(host.querySelector('section[data-role="heavy"]')).not.toBeNull();
    expect(host.querySelector('my-skel')).toBeNull();
  });
});
