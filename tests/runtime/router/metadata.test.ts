import { describe, expect, it } from 'vitest';
import { applyMetadata } from '../../../src/runtime/router/metadata.js';

describe('applyMetadata()', () => {
  it('sets title, meta tags, og and scripts', () => {
    document.head.innerHTML = '';
    document.title = '';
    applyMetadata({
      title: 'Home | UIDetox',
      meta: { description: 'HTML-first' },
      og: { title: 'Welcome', image: '/og.png' },
      scripts: ['/analytics.js'],
    });
    expect(document.title).toBe('Home | UIDetox');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('HTML-first');
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('Welcome');
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe('/og.png');
    expect(document.querySelector('script[src="/analytics.js"]')).not.toBeNull();
  });

  it('is idempotent for meta tags', () => {
    document.head.innerHTML = '';
    applyMetadata({ meta: { description: 'a' } });
    applyMetadata({ meta: { description: 'b' } });
    const nodes = document.querySelectorAll('meta[name="description"]');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].getAttribute('content')).toBe('b');
  });
});
