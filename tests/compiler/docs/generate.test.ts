import { describe, expect, it } from 'vitest';
import { extractDoc, renderDocPage } from '../../../src/compiler/docs/generate.js';

const SFC = `---
name: Card
tag: app-card
---

Displays a rounded surface with slotted content.

\`\`\`html example:basic
<app-card>Hello</app-card>
\`\`\`

\`\`\`html example:dark
<app-card class="dark">Hello dark</app-card>
\`\`\`
`;

describe('docs generation', () => {
  it('extracts name/tag/description/examples', () => {
    const doc = extractDoc(SFC);
    expect(doc.name).toBe('Card');
    expect(doc.tag).toBe('app-card');
    expect(doc.description).toContain('Displays a rounded surface');
    expect(doc.examples.map((e) => e.label)).toEqual(['basic', 'dark']);
    expect(doc.examples[0].html).toContain('<app-card>');
  });

  it('renders a stand-alone HTML page', () => {
    const html = renderDocPage(extractDoc(SFC));
    expect(html).toContain('<title>Card — UIDetox docs</title>');
    expect(html).toContain('&lt;app-card&gt;');
    expect(html).toContain('basic');
    expect(html).toContain('dark');
  });
});
