import { parseSfc } from '../sfc.js';

export interface DocEntry {
  name: string;
  tag?: string;
  description: string;
  examples: Array<{ label: string; html: string }>;
}

/**
 * Extracts documentation surface from a Markdown SFC:
 *  - frontmatter: name, tag, extends
 *  - Markdown body (between blocks): description text
 *  - `html example [<label>]` fenced blocks: usage snippets
 */
export function extractDoc(source: string): DocEntry {
  const sfc = parseSfc(source);
  const fm = sfc.frontmatter as { name?: string; tag?: string };
  const examples = sfc.blocks
    .filter((b) => b.role.startsWith('example'))
    .map((b) => {
      const parts = b.role.split(':');
      const label = parts[1] ?? 'default';
      return { label, html: b.content };
    });
  return {
    name: fm.name ?? 'Component',
    tag: fm.tag,
    description: (sfc.body ?? '').trim(),
    examples,
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/**
 * Renders a doc entry to a stand-alone HTML page (no external CSS).
 */
export function renderDocPage(entry: DocEntry): string {
  const examples = entry.examples
    .map(
      (ex) => `<section class="example"><h3>${esc(ex.label)}</h3><pre><code>${esc(ex.html)}</code></pre><div class="preview">${ex.html}</div></section>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${esc(entry.name)} — UIDetox docs</title>
<style>body{font:14px/1.5 system-ui;margin:2rem;max-width:64rem}h1,h2,h3{margin-top:1.5rem}pre{background:#f4f4f4;padding:.75rem;overflow:auto}.example{border:1px solid #ddd;padding:1rem;margin-top:1rem}.preview{padding:1rem;background:#fafafa;margin-top:.5rem}</style>
</head>
<body>
<h1>${esc(entry.name)}${entry.tag ? ` <small>&lt;${esc(entry.tag)}&gt;</small>` : ''}</h1>
<article>${entry.description}</article>
<h2>Examples</h2>
${examples || '<p><em>No examples declared.</em></p>'}
</body>
</html>`;
}
