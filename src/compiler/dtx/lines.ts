export const VERB_KEYWORDS = new Set(['component', 'trait', 'filter', 'token', 'provide', 'router']);
export const SECTION_KEYWORDS = new Set(['props', 'tpl', 'template', 'script', 'actions', 'effects', 'style']);
export const SIGNATURE_KEYWORDS = new Set(['on', 'off', 'transform', 'default']);
const MEMBER_KEYWORDS = new Set([...SECTION_KEYWORDS, ...SIGNATURE_KEYWORDS]);
const ALL_TERMINATORS = new Set([
  ...VERB_KEYWORDS,
  ...MEMBER_KEYWORDS,
  'declare',
  'import',
  'end',
]);

export interface RawMember {
  kind: 'section' | 'signature' | 'property' | 'import';
  keyword: string;
  header: string;
  body: string;
  scoped?: boolean;
}

export interface RawBlock {
  verb: string;
  header: string;
  isDeclare: boolean;
  declareKind?: string;
  members: RawMember[];
}

export interface ScanResult {
  imports: string[];
  blocks: RawBlock[];
}

function firstWord(line: string): string {
  const t = line.trim();
  const sp = t.search(/\s/);
  return sp === -1 ? t : t.slice(0, sp);
}

function normKeyword(kw: string): string {
  return kw; // tpl/template kept as-is; parser treats them equivalently
}

function captureSection(lines: string[], start: number): { body: string; next: number } {
  const bodyLines: string[] = [];
  let i = start;
  while (i < lines.length) {
    const fw = firstWord(lines[i]);
    if (ALL_TERMINATORS.has(fw)) {
      if (fw === 'end') { i++; }
      break;
    }
    bodyLines.push(lines[i]);
    i++;
  }
  return { body: bodyLines.join('\n'), next: i };
}

function captureSignature(lines: string[], start: number): { header: string; body: string; next: number } {
  // Collect from `start` until braces balance (or line ends if no brace).
  let text = '';
  let i = start;
  let depth = 0;
  let seenBrace = false;
  while (i < lines.length) {
    const line = lines[i];
    text += (text ? '\n' : '') + line;
    for (const ch of line) {
      if (ch === '{') { depth++; seenBrace = true; }
      else if (ch === '}') depth--;
    }
    i++;
    if (seenBrace && depth <= 0) break;
    if (!seenBrace && /\)\s*$/.test(line)) break; // off <event> name() with no body
  }
  const braceIdx = text.indexOf('{');
  if (braceIdx === -1) return { header: text.trim(), body: '', next: i };
  const closeIdx = text.lastIndexOf('}');
  return {
    header: text.slice(0, braceIdx).trim(),
    body: text.slice(braceIdx + 1, closeIdx),
    next: i,
  };
}

export function scanSource(source: string): ScanResult {
  const lines = source.split('\n');
  const imports: string[] = [];
  const blocks: RawBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const fw = firstWord(line);
    if (fw === '') { i++; continue; }

    if (fw === 'import') {
      imports.push(line.trim());
      i++;
      continue;
    }

    const isDeclare = fw === 'declare';
    if (VERB_KEYWORDS.has(fw) || isDeclare) {
      let verb: string;
      let declareKind: string | undefined;
      let header: string;
      if (isDeclare) {
        const parts = line.trim().split(/\s+/);
        declareKind = parts[1];
        verb = declareKind;
        header = parts.slice(1).join(' ');
      } else {
        verb = fw;
        header = line.trim().slice(fw.length).trim();
      }
      i++;

      const members: RawMember[] = [];
      while (i < lines.length) {
        const mLine = lines[i];
        const mfw = firstWord(mLine);
        if (mfw === '') { i++; continue; }
        if (VERB_KEYWORDS.has(mfw) || mfw === 'declare') break;
        if (mfw === 'end') {
          const parts = mLine.trim().split(/\s+/);
          // end <verb> closes the declaration; other ends already consumed by sections
          i++;
          if (parts[1] === verb || (isDeclare && parts[1] === declareKind)) break;
          continue;
        }
        if (mfw === 'import') {
          members.push({ kind: 'import', keyword: 'import', header: mLine.trim(), body: '' });
          i++;
          continue;
        }
        if (SECTION_KEYWORDS.has(mfw)) {
          const rest = mLine.trim().slice(mfw.length).trim();
          const scoped = /\bscoped\b/.test(rest);
          const cap = captureSection(lines, i + 1);
          members.push({ kind: 'section', keyword: normKeyword(mfw), header: mLine.trim(), body: cap.body, scoped });
          i = cap.next;
          continue;
        }
        if (SIGNATURE_KEYWORDS.has(mfw)) {
          const cap = captureSignature(lines, i);
          members.push({ kind: 'signature', keyword: mfw, header: cap.header, body: cap.body });
          i = cap.next;
          continue;
        }
        if (mLine.trim().startsWith('.')) {
          members.push({ kind: 'property', keyword: '.', header: mLine.trim(), body: '' });
          i++;
          continue;
        }
        // stray line — skip
        i++;
      }

      blocks.push({ verb, header, isDeclare, declareKind, members });
      continue;
    }

    i++;
  }

  return { imports, blocks };
}
