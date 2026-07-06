import { parseFragment } from 'parse5';
import type { TplAttr, TplNode } from './ast.js';

// Expression sentinels. Author `${...}` expressions are replaced with
// `<index>` before parse5 runs, so an HTML parser unaware of
// `${}` never splits an expression on interior spaces/slashes/braces.
const TOK_OPEN = '';
const TOK_CLOSE = '';
const TOKEN_RE = new RegExp(`${TOK_OPEN}(\\d+)${TOK_CLOSE}`, 'g');
const TOKEN_ONLY = new RegExp(`^${TOK_OPEN}(\\d+)${TOK_CLOSE}$`);

/**
 * Replaces every `${...}` in the source with an opaque token, tracking whether
 * each occurrence is an unquoted attribute value (which must be quoted so the
 * parser keeps it as a single value, including for void elements like `<input/>`).
 */
function protectExpressions(source: string): { masked: string; exprs: string[] } {
  const exprs: string[] = [];
  let out = '';
  let i = 0;
  const n = source.length;
  let inTag = false;
  let quote = '';
  while (i < n) {
    const ch = source[i];
    if (ch === '$' && source[i + 1] === '{') {
      let j = i + 1;
      let depth = 0;
      for (; j < n; j++) {
        const c = source[j];
        if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) { j++; break; }
        } else if (c === '"' || c === "'" || c === '`') {
          const q = c;
          j++;
          while (j < n) {
            if (source[j] === '\\') { j++; }
            else if (source[j] === q) break;
            j++;
          }
        }
      }
      const inner = source.slice(i + 2, j - 1).trim();
      const idx = exprs.length;
      exprs.push(inner);
      const token = `${TOK_OPEN}${idx}${TOK_CLOSE}`;
      const unquotedAttr = inTag && !quote && out.trimEnd().endsWith('=');
      out += unquotedAttr ? `"${token}"` : token;
      i = j;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = '';
    } else if (inTag && (ch === '"' || ch === "'")) {
      quote = ch;
    } else if (ch === '<') {
      inTag = true;
    } else if (ch === '>') {
      inTag = false;
    }
    out += ch;
    i++;
  }
  return { masked: out, exprs };
}

function restoreStatic(value: string, exprs: string[]): string {
  return value.replace(TOKEN_RE, (_, d: string) => `\${${exprs[Number(d)]}}`);
}

function tokenExpr(value: string, exprs: string[]): string | null {
  const m = TOKEN_ONLY.exec(value.trim());
  return m ? exprs[Number(m[1])] : null;
}

function classifyAttr(name: string, rawValue: string, exprs: string[]): TplAttr {
  const expr = tokenExpr(rawValue, exprs);
  if (name.startsWith('@')) {
    return { name, kind: 'event', value: expr ?? restoreStatic(rawValue, exprs) };
  }
  if (name.startsWith('.')) {
    return { name, kind: 'property', value: expr ?? restoreStatic(rawValue, exprs) };
  }
  if (name.startsWith('?')) {
    return { name, kind: 'boolean', value: expr ?? restoreStatic(rawValue, exprs) };
  }
  if (expr !== null) {
    return { name, kind: 'expression', value: expr };
  }
  return { name, kind: 'static', value: restoreStatic(rawValue, exprs) };
}

function splitTextWithInterpolations(text: string, exprs: string[]): TplNode[] {
  const nodes: TplNode[] = [];
  let cursor = 0;
  const rx = new RegExp(`${TOK_OPEN}(\\d+)${TOK_CLOSE}`, 'g');
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) {
    if (m.index > cursor) nodes.push({ type: 'text', value: text.slice(cursor, m.index) });
    nodes.push({ type: 'interpolation', expression: exprs[Number(m[1])] });
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) nodes.push({ type: 'text', value: text.slice(cursor) });
  return nodes;
}

// parse5 lowercases tag names. Recover author casing by scanning source.
function collectAuthorCasing(source: string): Map<number, string> {
  const casing = new Map<number, string>();
  const rx = /<\s*([A-Za-z][\w-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(source)) !== null) {
    casing.set(m.index, m[1]);
  }
  return casing;
}

interface P5Element {
  nodeName: string;
  tagName?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: P5Element[];
  /** parse5 stores <template> children in a content DocumentFragment. */
  content?: { childNodes: P5Element[] };
  sourceCodeLocation?: {
    startTag?: { startOffset: number; endOffset: number };
    startOffset?: number;
  };
  value?: string;
}

// Control-flow tags that the HTML5 parser would strip inside <select>/<table>/….
// Rewrite them to <template data-uidx="<tag>"> before parsing (parse5 keeps
// <template> anywhere), then reconstruct the original element in `convert`.
const CONTROL_FLOW_TAGS = 'virtual-for|for|if|else|case|when';

function rewriteControlFlow(source: string): string {
  return source
    .replace(new RegExp(`<(${CONTROL_FLOW_TAGS})(\\s|>)`, 'g'), '<template data-uidx="$1"$2')
    .replace(new RegExp(`</(${CONTROL_FLOW_TAGS})>`, 'g'), '</template>');
}

function camelize(name: string): string {
  return name.replace(/-([a-z0-9])/gi, (_, c: string) => c.toUpperCase());
}

const REF_MARKER = new RegExp(`(?:^|\\s)#(?:${TOK_OPEN}(\\d+)${TOK_CLOSE}|([A-Za-z0-9_-]+))`);

function isDynamic(value: string): boolean {
  return TOKEN_ONLY.test(value.trim());
}

function extractRef(
  node: P5Element,
  source: string,
  exprs: string[],
): { refKey?: string; refExpr?: string } {
  // Explicit #marker — scan the raw start-tag source (parse5 lowercases attr names).
  const st = node.sourceCodeLocation?.startTag;
  if (st) {
    const raw = source.slice(st.startOffset, st.endOffset);
    const m = REF_MARKER.exec(raw);
    if (m) {
      if (m[1] !== undefined) return { refExpr: exprs[Number(m[1])] };
      if (m[2] !== undefined) return { refKey: camelize(m[2]) };
    }
  }
  // Auto-bind static name, else static id.
  const nameAttr = (node.attrs ?? []).find((a) => a.name === 'name');
  if (nameAttr && !isDynamic(nameAttr.value)) return { refKey: camelize(nameAttr.value) };
  const idAttr = (node.attrs ?? []).find((a) => a.name === 'id');
  if (idAttr && !isDynamic(idAttr.value)) return { refKey: camelize(idAttr.value) };
  return {};
}

function convert(
  node: P5Element,
  casedByOffset: Map<number, string>,
  source: string,
  exprs: string[],
): TplNode[] {
  if (node.nodeName === '#text') {
    return splitTextWithInterpolations(node.value ?? '', exprs);
  }
  if (node.tagName) {
    // A rewritten control-flow element: reconstruct its real tag + take children
    // from the <template> content fragment.
    const uidx = node.tagName === 'template'
      ? node.attrs?.find((a) => a.name === 'data-uidx')?.value
      : undefined;
    const offset =
      node.sourceCodeLocation?.startTag?.startOffset ??
      node.sourceCodeLocation?.startOffset;
    const authorTag =
      uidx ??
      (offset !== undefined ? casedByOffset.get(offset) : undefined) ??
      node.tagName;
    const attrs: TplAttr[] = (node.attrs ?? [])
      .filter((a) => a.name !== 'data-uidx')
      .map((a) => classifyAttr(a.name, a.value, exprs));
    const childNodes = (uidx || node.tagName === 'template')
      ? node.content?.childNodes ?? []
      : node.childNodes ?? [];
    const children: TplNode[] = [];
    for (const child of childNodes) {
      children.push(...convert(child, casedByOffset, source, exprs));
    }
    const el: TplNode = { type: 'element', tag: authorTag, attrs, children };
    const { refKey, refExpr } = extractRef(node, source, exprs);
    if (refKey) el.refKey = refKey;
    if (refExpr) el.refExpr = refExpr;
    return [el];
  }
  const kids: TplNode[] = [];
  for (const child of node.childNodes ?? []) {
    kids.push(...convert(child, casedByOffset, source, exprs));
  }
  return kids;
}

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function expandSelfClosing(source: string): string {
  return source.replace(/<([A-Za-z][\w-]*)\b([^>]*?)\/>/g, (match, tag: string, attrs: string) => {
    if (VOID_ELEMENTS.has(tag.toLowerCase())) return match;
    return `<${tag}${attrs}></${tag}>`;
  });
}

export function parseTemplate(source: string): TplNode[] {
  const { masked, exprs } = protectExpressions(source);
  const normalized = rewriteControlFlow(expandSelfClosing(masked));
  const casedByOffset = collectAuthorCasing(normalized);
  const fragment = parseFragment(normalized, { sourceCodeLocationInfo: true });
  const out: TplNode[] = [];
  for (const child of (fragment as unknown as { childNodes: P5Element[] }).childNodes) {
    out.push(...convert(child, casedByOffset, normalized, exprs));
  }
  return out;
}
