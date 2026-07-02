export interface PageMetadataPayload {
  title?: string;
  meta?: Record<string, string>;
  og?: Record<string, string>;
  rel?: Array<Record<string, string>>;
  scripts?: string[];
  styles?: string[];
  structuredData?: unknown;
}

function upsertMeta(name: string, content: string): void {
  let node = document.querySelector(`meta[name="${name}"]`);
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute('name', name);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

function upsertOg(name: string, content: string): void {
  const property = `og:${name}`;
  let node = document.querySelector(`meta[property="${property}"]`);
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute('property', property);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

function appendOnce(selector: string, factory: () => HTMLElement): void {
  if (document.head.querySelector(selector)) return;
  document.head.appendChild(factory());
}

export function applyMetadata(payload: PageMetadataPayload): void {
  if (payload.title !== undefined) document.title = payload.title;
  if (payload.meta) for (const [k, v] of Object.entries(payload.meta)) upsertMeta(k, v);
  if (payload.og) for (const [k, v] of Object.entries(payload.og)) upsertOg(k, v);
  if (payload.rel) {
    for (const attrs of payload.rel) {
      const query = Object.entries(attrs).map(([k, v]) => `[${k}="${v}"]`).join('');
      appendOnce(`link${query}`, () => {
        const el = document.createElement('link');
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        return el;
      });
    }
  }
  if (payload.scripts) {
    for (const src of payload.scripts) {
      appendOnce(`script[src="${src}"]`, () => {
        const el = document.createElement('script');
        el.src = src;
        return el;
      });
    }
  }
  if (payload.styles) {
    for (const href of payload.styles) {
      appendOnce(`link[rel="stylesheet"][href="${href}"]`, () => {
        const el = document.createElement('link');
        el.rel = 'stylesheet';
        el.href = href;
        return el;
      });
    }
  }
  if (payload.structuredData !== undefined) {
    const existing = document.head.querySelector('script[type="application/ld+json"]');
    if (existing) existing.remove();
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = JSON.stringify(payload.structuredData);
    document.head.appendChild(el);
  }
}
