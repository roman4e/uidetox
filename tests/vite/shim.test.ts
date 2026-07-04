import { describe, expect, it } from 'vitest';
import { generateTsShim } from '../../src/vite/shim.js';

const DTX = `component Counter tag app-counter
props
number start
string label
end props
template
<div></div>
end template
end component
`;

const MD = `---
tag: hello-box
---

\`\`\`ts props
export type Props = { who: string };
\`\`\`

\`\`\`html template
<p>hi</p>
\`\`\`
`;

describe('generateTsShim', () => {
  it('emits Props from a .dtx props section (dtx types → TS)', () => {
    const shim = generateTsShim('/x/Counter.dtx', DTX);
    expect(shim).toContain('start?: number;');
    expect(shim).toContain('label?: string;');
    expect(shim).toContain('export default _default;');
    expect(shim).toContain('(props?: Props) => HTMLElement');
  });

  it('uses the .md props block verbatim', () => {
    const shim = generateTsShim('/x/Hello.md', MD);
    expect(shim).toContain('export type Props = { who: string };');
    expect(shim).toContain('export default _default;');
  });

  it('falls back to a permissive Props when none declared', () => {
    const shim = generateTsShim('/x/Bare.dtx', 'component Bare tag app-bare\ntemplate\n<i/>\nend template\nend component\n');
    expect(shim).toContain('Props = Record<string, unknown>');
    expect(shim).toContain('export default _default;');
  });
});
