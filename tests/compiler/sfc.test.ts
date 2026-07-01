import { describe, expect, it } from 'vitest';
import { parseSfc } from '../../src/compiler/sfc.js';

const SAMPLE = `---
name: Todo
tag: app-todo
---

# Todo

Displays a single todo.

\`\`\`ts props
export type Props = { title: string };
\`\`\`

\`\`\`html template
<li>\${props.title}</li>
\`\`\`

\`\`\`ts script
const s = state({ open: true });
\`\`\`

\`\`\`css style
.todo { padding: 1rem; }
\`\`\`
`;

describe('parseSfc()', () => {
  it('parses YAML frontmatter', () => {
    const sfc = parseSfc(SAMPLE);
    expect(sfc.frontmatter).toEqual({ name: 'Todo', tag: 'app-todo' });
  });

  it('collects roled fenced blocks', () => {
    const sfc = parseSfc(SAMPLE);
    const roles = sfc.blocks.map((b) => `${b.lang}/${b.role}`);
    expect(roles).toEqual([
      'ts/props',
      'html/template',
      'ts/script',
      'css/style',
    ]);
  });

  it('preserves original content of each block', () => {
    const sfc = parseSfc(SAMPLE);
    const tpl = sfc.blocks.find((b) => b.role === 'template');
    expect(tpl?.content.trim()).toBe('<li>${props.title}</li>');
  });

  it('ignores fenced blocks without a role', () => {
    const src =
      '\n```ts\nconst x = 1;\n```\n\n```ts script\nconst y = 2;\n```\n';
    const sfc = parseSfc(src);
    expect(sfc.blocks.map((b) => b.role)).toEqual(['script']);
  });
});
