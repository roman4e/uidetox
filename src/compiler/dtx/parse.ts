import { tokenize, type Token } from './tokenize.js';
import { scanSource, type RawBlock, type RawMember } from './lines.js';
import type {
  Clause,
  Declaration,
  DtxAst,
  ImportStatement,
  Member,
  ParamSpec,
  Verb,
} from './types.js';

const VERBS = new Set<Verb>(['trait', 'filter', 'token', 'provide', 'component']);

/** Token-based parser for a declaration header (name + clauses). */
class HeaderParser {
  public i = 0;
  constructor(private tokens: Token[]) {}
  peek(o = 0): Token | undefined { return this.tokens[this.i + o]; }
  next(): Token { return this.tokens[this.i++]; }
  eatSymbol(s: string): boolean {
    const t = this.peek();
    if (t && t.kind === 'symbol' && t.value === s) { this.i++; return true; }
    return false;
  }

  parseClauseList(): string[] {
    if (!this.eatSymbol('[')) return [];
    const items: string[] = [];
    while (true) {
      const t = this.next();
      if (t.kind !== 'word') throw new Error('list item expected');
      items.push(t.value);
      if (this.eatSymbol(']')) return items;
      if (!this.eatSymbol(',')) throw new Error(', or ] expected');
    }
  }

  parseParamSpecs(): ParamSpec[] {
    if (!this.eatSymbol('(')) throw new Error('params expects (');
    const params: ParamSpec[] = [];
    if (this.eatSymbol(')')) return params;
    while (true) {
      const typeTok = this.next();
      if (typeTok.kind !== 'word') throw new Error('param type expected');
      const optional = this.eatSymbol('?');
      const nameTok = this.next();
      if (nameTok.kind !== 'word') throw new Error('param name expected');
      let defaultValue: string | undefined;
      const nx = this.peek();
      if (nx && (nx.kind === 'string' || (nx.kind === 'word' && /^[0-9]/.test(nx.value)) || (nx.kind === 'word' && (nx.value === 'true' || nx.value === 'false')))) {
        this.i++;
        defaultValue = nx.kind === 'string' ? JSON.stringify(nx.value) : nx.value;
      }
      params.push({ type: typeTok.value, optional, name: nameTok.value, defaultValue });
      if (this.eatSymbol(')')) return params;
      if (!this.eatSymbol(',')) throw new Error(', or ) expected');
    }
  }

  parseClauses(): Clause[] {
    const clauses: Clause[] = [];
    while (true) {
      const t = this.peek();
      if (!t) break;
      if (t.kind === 'symbol') { this.i++; continue; }
      if (t.kind !== 'word') { this.i++; continue; }
      this.i++;
      const key = t.value;
      if (key === 'export' || key === 'disabled') { clauses.push({ key, kind: 'flag' }); continue; }
      const nx = this.peek();
      if (!nx) { clauses.push({ key, kind: 'flag' }); continue; }
      if (nx.kind === 'symbol' && nx.value === '[') {
        const items = this.parseClauseList();
        clauses.push({ key, kind: key === 'extends' ? 'list-of-refs' : 'list', items });
        continue;
      }
      if (nx.kind === 'symbol' && nx.value === '(') {
        clauses.push({ key, kind: 'params', params: this.parseParamSpecs() });
        continue;
      }
      if (nx.kind === 'string') {
        this.i++;
        clauses.push({ key, kind: 'value', value: nx.value });
        continue;
      }
      if (nx.kind === 'word' &&
          nx.value !== 'export' && nx.value !== 'input' && nx.value !== 'output' &&
          nx.value !== 'appliesto' && nx.value !== 'params' && nx.value !== 'extends' && nx.value !== 'tag' && nx.value !== 'from') {
        this.i++;
        clauses.push({ key, kind: 'value', value: nx.value });
        continue;
      }
      clauses.push({ key, kind: 'flag' });
    }
    return clauses;
  }
}

function parseHeader(header: string): { name: string; clauses: Clause[] } {
  const tokens = tokenize(header);
  const p = new HeaderParser(tokens);
  const nameTok = p.next();
  const name = nameTok && nameTok.kind === 'word' ? nameTok.value : (nameTok?.value ?? '');
  const clauses = p.parseClauses();
  return { name, clauses };
}

const SIG_ON = /^(on|off)\s+(\S+)\s+(\*|\w+)?\s*\(\s*\)/;
const SIG_FN = /^(transform|default)\s+(\*|\w+)?\s*\(\s*\)/;

function nameOrNull(v: string | undefined): string | null {
  if (v === undefined || v === '*') return null;
  return v;
}

function parseSignatureMember(m: RawMember): Member {
  const onM = SIG_ON.exec(m.header);
  if (onM) {
    const kind = onM[1] as 'on' | 'off';
    if (kind === 'off') return { kind, event: onM[2], name: nameOrNull(onM[3]) };
    return { kind, event: onM[2], name: nameOrNull(onM[3]), body: m.body };
  }
  const fnM = SIG_FN.exec(m.header);
  if (fnM) {
    return { kind: fnM[1] as 'transform' | 'default', name: nameOrNull(fnM[2]), body: m.body };
  }
  throw new Error(`unrecognised signature member: ${m.header}`);
}

const SECTION_KIND: Record<string, Member['kind']> = {
  props: 'props',
  tpl: 'template',
  template: 'template',
  script: 'script',
  actions: 'actions',
  effects: 'effects',
  style: 'style',
};

function parseMember(m: RawMember): Member | null {
  if (m.kind === 'section') {
    return { kind: SECTION_KIND[m.keyword], name: null, body: m.body, scoped: m.scoped };
  }
  if (m.kind === 'signature') return parseSignatureMember(m);
  if (m.kind === 'property') {
    const pm = /^\.(\w+)\s*=\s*(.+)$/.exec(m.header);
    if (!pm) return null;
    return { kind: 'prop', name: pm[1], propValue: pm[2].trim() };
  }
  return null;
}

function parseImportLine(line: string): ImportStatement {
  // import <names> [from <path>]
  const body = line.trim().replace(/^import\s+/, '');
  const fromMatch = /\bfrom\s+"([^"]+)"\s*$/.exec(body);
  const from = fromMatch ? fromMatch[1] : null;
  const namesPart = fromMatch ? body.slice(0, fromMatch.index).trim() : body.trim();
  const items = namesPart
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((seg) => {
      const asM = /^(\S+)\s+as\s+(\S+)$/.exec(seg);
      if (asM) return { source: asM[1], alias: asM[2] };
      return { source: seg };
    });
  return { from, items, sourceOffset: 0, sourceEndOffset: 0 };
}

function blockToDeclaration(b: RawBlock): Declaration {
  const { name, clauses } = parseHeader(b.header);
  const members: Member[] = [];
  for (const rm of b.members) {
    if (rm.kind === 'import') continue; // component-level imports handled at emit level (future)
    const mem = parseMember(rm);
    if (mem) members.push(mem);
  }
  const verb = (VERBS.has(b.verb as Verb) ? b.verb : 'component') as Verb;
  return {
    verb,
    name,
    clauses,
    members,
    isDeclare: b.isDeclare,
    declareKind: b.declareKind,
    sourceOffset: 0,
    sourceEndOffset: 0,
  };
}

export function parseDtx(source: string): DtxAst {
  const scan = scanSource(source);
  const imports = scan.imports.map(parseImportLine);
  const declarations = scan.blocks.filter((b) => !b.isDeclare).map(blockToDeclaration);
  return { imports, declarations };
}

export { scanSource };
