import { tokenize, type Token } from './tokenize.js';
import type {
  Clause,
  Declaration,
  DtxAst,
  ImportStatement,
  Member,
  ParamSpec,
  Verb,
} from './types.js';

const VERBS = new Set<Verb>(['trait', 'filter', 'token', 'provide']);

class Parser {
  public i = 0;
  constructor(private tokens: Token[]) {}

  peek(offset = 0): Token | undefined {
    return this.tokens[this.i + offset];
  }
  next(): Token {
    return this.tokens[this.i++];
  }
  eatSymbol(sym: string): boolean {
    const t = this.peek();
    if (t && t.kind === 'symbol' && t.value === sym) { this.i++; return true; }
    return false;
  }
  eatWord(word: string): boolean {
    const t = this.peek();
    if (t && t.kind === 'word' && t.value === word) { this.i++; return true; }
    return false;
  }

  parseImport(): ImportStatement | null {
    const first = this.peek();
    if (!first || first.kind !== 'word' || first.value !== 'from') return null;
    const start = first.offset;
    this.i++;
    const pathTok = this.next();
    if (pathTok.kind !== 'string') throw new Error('from expects a string path');
    const items: ImportStatement['items'] = [];
    if (this.eatWord('import')) {
      while (true) {
        const nameTok = this.next();
        if (nameTok.kind !== 'word') throw new Error('import expects a name');
        const item: { source: string; alias?: string } = { source: nameTok.value };
        if (this.eatWord('as')) {
          const aliasTok = this.next();
          if (aliasTok.kind !== 'word') throw new Error('as expects a name');
          item.alias = aliasTok.value;
        }
        items.push(item);
        if (!this.eatSymbol(',')) break;
      }
    }
    return { path: pathTok.value, items, sourceOffset: start, sourceEndOffset: this.tokens[this.i - 1].offset };
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
      const next = this.peek();
      if (next && (next.kind === 'string' || (next.kind === 'word' && /^[0-9]/.test(next.value)) || (next.kind === 'word' && (next.value === 'true' || next.value === 'false')))) {
        this.i++;
        defaultValue = next.kind === 'string' ? JSON.stringify(next.value) : next.value;
      }
      params.push({ type: typeTok.value, optional, name: nameTok.value, defaultValue });
      if (this.eatSymbol(')')) return params;
      if (!this.eatSymbol(',')) throw new Error(', or ) expected');
    }
  }

  isMemberStart(): boolean {
    const t = this.peek();
    if (!t) return false;
    if (t.kind === 'symbol' && t.value === '.') return true;
    if (t.kind === 'word' && (t.value === 'on' || t.value === 'off' || t.value === 'transform' || t.value === 'default')) return true;
    return false;
  }

  parseClauses(): Clause[] {
    const clauses: Clause[] = [];
    while (true) {
      const t = this.peek();
      if (!t) break;
      if (t.kind === 'symbol') break;
      if (t.kind !== 'word') break;
      if (VERBS.has(t.value as Verb)) break;
      if (this.isMemberStart()) break;
      this.i++;
      const key = t.value;
      // Known always-flag keys
      if (key === 'export' || key === 'disabled') {
        clauses.push({ key, kind: 'flag' });
        continue;
      }
      const nextTok = this.peek();
      if (!nextTok) { clauses.push({ key, kind: 'flag' }); continue; }
      if (nextTok.kind === 'symbol' && nextTok.value === '[') {
        const items = this.parseClauseList();
        clauses.push({ key, kind: key === 'extends' ? 'list-of-refs' : 'list', items });
        continue;
      }
      if (nextTok.kind === 'symbol' && nextTok.value === '(') {
        clauses.push({ key, kind: 'params', params: this.parseParamSpecs() });
        continue;
      }
      if (nextTok.kind === 'word' && !VERBS.has(nextTok.value as Verb) &&
          nextTok.value !== 'on' && nextTok.value !== 'transform' && nextTok.value !== 'default' &&
          nextTok.value !== 'export' && nextTok.value !== 'input' && nextTok.value !== 'output' &&
          nextTok.value !== 'appliesto' && nextTok.value !== 'params' && nextTok.value !== 'from') {
        this.i++;
        clauses.push({ key, kind: 'value', value: nextTok.value });
        continue;
      }
      clauses.push({ key, kind: 'flag' });
    }
    return clauses;
  }

  parseMember(): Member | null {
    const t = this.peek();
    if (!t) return null;
    if (t.kind === 'symbol' && t.value === '.') {
      this.i++;
      const nameTok = this.next();
      if (nameTok.kind !== 'word') throw new Error('prop name expected');
      if (!this.eatSymbol('=')) throw new Error('= expected');
      const valueTok = this.next();
      const propValue = valueTok.kind === 'string' ? JSON.stringify(valueTok.value) : valueTok.value;
      return { kind: 'prop', name: nameTok.value, propValue };
    }
    if (t.kind === 'word' && t.value === 'off') {
      this.i++;
      const eventTok = this.next();
      if (eventTok.kind !== 'word') throw new Error('off <event> expected');
      const event = eventTok.value;
      let name: string | null = null;
      const nextTok = this.peek();
      if (nextTok && nextTok.kind === 'symbol' && nextTok.value === '*') {
        this.i++;
        name = null;
      } else if (nextTok && nextTok.kind === 'word') {
        this.i++;
        name = nextTok.value;
      }
      if (!this.eatSymbol('(')) throw new Error('( expected');
      if (!this.eatSymbol(')')) throw new Error(') expected');
      return { kind: 'off', event, name };
    }
    if (t.kind === 'word' && t.value === 'on') {
      this.i++;
      const eventTok = this.next();
      const event = eventTok.value;
      let name: string | null = null;
      const maybeName = this.peek();
      const maybeParen = this.tokens[this.i + 1];
      if (maybeName && maybeName.kind === 'word' && maybeParen && maybeParen.kind === 'symbol' && maybeParen.value === '(') {
        this.i++;
        name = maybeName.value;
      }
      if (!this.eatSymbol('(')) throw new Error('( expected after on <event> [name]');
      if (!this.eatSymbol(')')) throw new Error(') expected');
      const bodyTok = this.next();
      if (bodyTok.kind !== 'body') throw new Error('{ body } expected');
      return { kind: 'on', event, name, body: bodyTok.value };
    }
    if (t.kind === 'word' && (t.value === 'transform' || t.value === 'default')) {
      const kind = t.value as 'transform' | 'default';
      this.i++;
      let name: string | null = null;
      const nameTok = this.peek();
      const maybeParen = this.tokens[this.i + 1];
      if (nameTok && nameTok.kind === 'word' && maybeParen && maybeParen.kind === 'symbol' && maybeParen.value === '(') {
        this.i++;
        name = nameTok.value;
      }
      if (!this.eatSymbol('(')) throw new Error('( expected');
      if (!this.eatSymbol(')')) throw new Error(') expected');
      const bodyTok = this.next();
      if (bodyTok.kind !== 'body') throw new Error('{ body } expected');
      return { kind, name, body: bodyTok.value };
    }
    return null;
  }

  parseDeclaration(): Declaration | null {
    const verbTok = this.peek();
    if (!verbTok || verbTok.kind !== 'word' || !VERBS.has(verbTok.value as Verb)) return null;
    const start = verbTok.offset;
    const verb = verbTok.value as Verb;
    this.i++;
    const nameTok = this.next();
    if (nameTok.kind !== 'word') throw new Error(`${verb} name expected`);
    const clauses = this.parseClauses();
    const members: Member[] = [];
    while (true) {
      const before = this.i;
      if (!this.isMemberStart()) break;
      const m = this.parseMember();
      if (!m) { this.i = before; break; }
      members.push(m);
    }
    const endOffset = this.tokens[this.i - 1]?.offset ?? start;
    return {
      verb,
      name: nameTok.value,
      clauses,
      members,
      sourceOffset: start,
      sourceEndOffset: endOffset,
    };
  }
}

export function parseDtx(source: string): DtxAst {
  const parser = new Parser(tokenize(source));
  const imports: ImportStatement[] = [];
  const declarations: Declaration[] = [];
  while (parser.peek()) {
    const imp = parser.parseImport();
    if (imp) { imports.push(imp); continue; }
    const decl = parser.parseDeclaration();
    if (decl) { declarations.push(decl); continue; }
    parser.i++;
  }
  return { imports, declarations };
}
