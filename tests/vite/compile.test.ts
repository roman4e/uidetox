import { describe, expect, it } from 'vitest';
import { compileModule, isComponentSource } from '../../src/vite/compile.js';
import { createTagRegistry } from '../../src/vite/tags.js';

const DTX = `component AppCard tag app-card
template
<div class="card"><slot/></div>
end template
end component
`;

const MD = `---
name: Hello
tag: hello-box
---

\`\`\`html template
<p>hi</p>
\`\`\`
`;

describe('compileModule', () => {
  it('compiles .dtx to ESM and extracts the tag', () => {
    const m = compileModule('/x/AppCard.dtx', DTX);
    expect(m.code).toContain('defineComponent');
    expect(m.tag).toBe('app-card');
  });

  it('compiles .md SFC and returns the tag', () => {
    const m = compileModule('/x/Hello.md', MD);
    expect(m.code).toContain('defineComponent');
    expect(m.tag).toBe('hello-box');
  });

  it('rejects other extensions', () => {
    expect(() => compileModule('/x/foo.ts', '')).toThrow(/cannot compile/);
  });

  it('isComponentSource matches .dtx/.md only', () => {
    expect(isComponentSource('a.dtx')).toBe(true);
    expect(isComponentSource('a.md')).toBe(true);
    expect(isComponentSource('a.ts')).toBe(false);
  });
});

describe('createTagRegistry', () => {
  it('allows re-registering the same tag from the same file (HMR-safe)', () => {
    const r = createTagRegistry();
    r.register('app-card', '/x/AppCard.dtx');
    expect(() => r.register('app-card', '/x/AppCard.dtx')).not.toThrow();
  });

  it('throws on a duplicate tag from a different file', () => {
    const r = createTagRegistry();
    r.register('app-card', '/x/AppCard.dtx');
    expect(() => r.register('app-card', '/y/Other.dtx')).toThrow(/duplicate custom-element tag "app-card"/);
  });

  it('ignores null tags (traits/filters)', () => {
    const r = createTagRegistry();
    expect(() => { r.register(null, '/x/trait.dtx'); r.register(null, '/y/trait.dtx'); }).not.toThrow();
  });
});
