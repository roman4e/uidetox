export type Token =
  | { kind: 'word'; value: string; offset: number }
  | { kind: 'string'; value: string; offset: number }
  | { kind: 'symbol'; value: string; offset: number }
  | { kind: 'body'; value: string; offset: number };

const WORD_RE = /[A-Za-z_$][A-Za-z0-9_$-]*|[0-9]+/y;
const SYMBOLS = new Set(['(', ')', '[', ']', ',', '?', '.', '=', ':', '*']);

export function tokenize(source: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const len = source.length;
  while (i < len) {
    const c = source[i];
    if (c === '\n' || c === '\r' || c === ' ' || c === '\t') { i++; continue; }
    if (c === '"') {
      const start = i + 1;
      i++;
      while (i < len && source[i] !== '"') i++;
      out.push({ kind: 'string', value: source.slice(start, i), offset: start });
      i++;
      continue;
    }
    if (c === '{') {
      const start = i + 1;
      let depth = 1;
      let j = i + 1;
      while (j < len && depth > 0) {
        const ch = source[j];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        if (depth === 0) break;
        j++;
      }
      out.push({ kind: 'body', value: source.slice(start, j), offset: start });
      i = j + 1;
      continue;
    }
    if (SYMBOLS.has(c)) {
      out.push({ kind: 'symbol', value: c, offset: i });
      i++;
      continue;
    }
    WORD_RE.lastIndex = i;
    const m = WORD_RE.exec(source);
    if (m) {
      out.push({ kind: 'word', value: m[0], offset: i });
      i += m[0].length;
      continue;
    }
    i++;
  }
  return out;
}
