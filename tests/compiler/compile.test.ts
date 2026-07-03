import { describe, expect, it } from 'vitest';
import { compile } from '../../src/compiler/compile.js';

const SFC = `---
name: Greeter
tag: x-greeter
---

\`\`\`ts props
export type Props = { who: string };
\`\`\`

\`\`\`html template
<span>hello \${props.who}</span>
\`\`\`

\`\`\`ts script
const count = 0;
\`\`\`
`;

describe('compile()', () => {
  it('produces an ES module that calls defineComponent for the tag', () => {
    const { js, tag } = compile(SFC);
    expect(tag).toBe('x-greeter');
    expect(js).toContain('import { defineComponent, __el, __text, __bind, __if, __for, __case, __ref, __fragment, CASE_DEFAULT } from "uidetox";');
    expect(js).toContain('defineComponent({');
    expect(js).toContain('tag: "x-greeter"');
    expect(js).toContain('__el("span"');
    expect(js).toContain('props: ["who"]');
  });
});
