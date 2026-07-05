// Scoped-CSS extraction for the Vite plugin: pull `style [scoped]` bodies out of
// a component so Vite's CSS pipeline (PostCSS, @import, HMR) can process them,
// instead of shipping them as raw <style> strings.

export interface ExtractedCss {
  css: string;
  scoped: boolean;
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

export function cssHash(id: string, css: string): string {
  return djb2(`${id}::${css}`);
}

/** Reads the `style` body (and whether it is `scoped`) from a `.dtx` or `.md` source. */
export function extractStyleSource(id: string, source: string): ExtractedCss | null {
  if (id.endsWith('.md')) {
    const m = /```(?:css\s+style|style)\b[^\n]*\n([\s\S]*?)```/.exec(source);
    return m ? { css: m[1].trim(), scoped: /\bscoped\b/.test(m[0].split('\n')[0]) } : null;
  }
  // .dtx: a `style [scoped]` section until `end`/next keyword.
  const lines = source.split('\n');
  const start = lines.findIndex((l) => l.trim().split(/\s+/)[0] === 'style');
  if (start === -1) return null;
  const scoped = /\bscoped\b/.test(lines[start]);
  const STOP = new Set(['end', 'template', 'tpl', 'script', 'actions', 'effects', 'props', 'task', 'routes', 'component', 'trait', 'filter', 'token', 'provide', 'router', 'declare', 'import']);
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (STOP.has(lines[i].trim().split(/\s+/)[0])) break;
    body.push(lines[i]);
  }
  return { css: body.join('\n').trim(), scoped };
}

/**
 * Prefixes each top-level selector with the component tag for isolation.
 * At-rules (`@media`, `@keyframes`) and `:root` are left global so custom-property
 * inheritance (`var(--fg)`) is preserved. Declarations are never touched.
 */
export function scopeCss(css: string, tag: string): string {
  return css.replace(/([^{}]+)(\{[^{}]*\})/g, (_full, selector: string, block: string) => {
    const sel = selector.trim();
    if (!sel || sel.startsWith('@') || sel.startsWith(':root')) return `${selector}${block}`;
    const scoped = sel
      .split(',')
      .map((s) => `${tag} ${s.trim()}`)
      .join(', ');
    const lead = selector.slice(0, selector.length - selector.trimStart().length);
    return `${lead}${scoped} ${block}`;
  });
}

const VIRTUAL_PREFIX = 'virtual:uidetox-css/';

export function virtualCssId(hash: string): string {
  return `${VIRTUAL_PREFIX}${hash}.css`;
}

export function isVirtualCssId(id: string): boolean {
  return id.startsWith(VIRTUAL_PREFIX) || id.startsWith('\0' + VIRTUAL_PREFIX);
}

/** Removes the inline `style: "..."` field from compiled component JS. */
export function stripInlineStyle(code: string): string {
  return code.replace(/,\s*\n?\s*style:\s*"(?:[^"\\]|\\.)*"/, '');
}
