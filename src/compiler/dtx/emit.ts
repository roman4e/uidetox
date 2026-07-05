import { kebabToCamel } from './namespace.js';
import { parseDtx } from './parse.js';
import { emitComponent } from './component.js';
import { parseTemplate } from '../template/parse.js';
import { transformDirectives } from '../template/transform.js';
import { codegen } from '../template/codegen.js';
import type {
  Declaration,
  DeclareDecl,
  DtxAst,
  ImportStatement,
  Member,
  ParamSpec,
} from './types.js';

import { resolveSpecifier, type SpecifierOptions } from './resolve.js';

const RUNTIME_MODULE = 'uidetox';

// All emitted string literals use double quotes (JSON.stringify handles escaping,
// including newlines in multi-line style/script bodies).
function sq(v: unknown): string {
  return JSON.stringify(v);
}

function extendsRef(decl: Declaration): string {
  const clause = decl.clauses.find((c) => c.key === 'extends');
  if (!clause?.items || clause.items.length === 0) return '';
  const refs = clause.items.map((n) => kebabToCamel(n)).join(', ');
  return `extends: [${refs}]`;
}

function offMap(members: Member[], event = 'event'): string {
  const offs = members.filter((m) => m.kind === 'off' && (event === 'transform' ? m.event === 'transform' : m.event !== 'transform'));
  if (offs.length === 0) return '';
  if (event === 'transform') {
    const names = offs.map((m) => m.name);
    if (names.includes(null)) return `offTransform: "all"`;
    return `offTransform: [${names.map((n) => sq(n as string)).join(', ')}]`;
  }
  const byEvent = new Map<string, Array<string | null>>();
  for (const m of offs) {
    if (!byEvent.has(m.event!)) byEvent.set(m.event!, []);
    byEvent.get(m.event!)!.push(m.name);
  }
  const entries: string[] = [];
  for (const [ev, names] of byEvent) {
    if (names.includes(null)) entries.push(`${sq(ev)}: "all"`);
    else entries.push(`${sq(ev)}: [${names.map((n) => sq(n as string)).join(', ')}]`);
  }
  return `off: { ${entries.join(', ')} }`;
}

function emitParamsSchema(params: ParamSpec[]): string {
  if (params.length === 0) return '{}';
  const entries = params.map((p) => {
    const parts: string[] = [`type: ${sq(p.type)}`];
    if (p.optional) parts.push('optional: true');
    if (p.defaultValue !== undefined) parts.push(`default: ${p.defaultValue}`);
    return `${p.name}: { ${parts.join(', ')} }`;
  });
  return `{ ${entries.join(', ')} }`;
}

function emitTraitHandlers(members: Member[]): string {
  const byEvent = new Map<string, Array<{ name: string | null; body: string }>>();
  for (const m of members) {
    if (m.kind !== 'on') continue;
    const event = m.event ?? '';
    if (!byEvent.has(event)) byEvent.set(event, []);
    byEvent.get(event)!.push({ name: m.name, body: m.body ?? '' });
  }
  const entries: string[] = [];
  for (const [event, handlers] of byEvent) {
    const items = handlers.map((h) => {
      const nameField = h.name ? `name: ${sq(h.name)}` : 'name: null';
      const runField = `run(this: any) {${h.body}\n}`;
      return `{ ${nameField}, ${runField} }`;
    });
    entries.push(`${sq(event)}: [${items.join(', ')}]`);
  }
  return `{ ${entries.join(', ')} }`;
}

function emitTraitProps(members: Member[]): string {
  const props = members.filter((m) => m.kind === 'prop');
  if (props.length === 0) return '() => ({})';
  const body = props.map((p) => `${p.name}: ${p.propValue}`).join(', ');
  return `() => ({ ${body} })`;
}

function emitTraitDecl(decl: Declaration): string {
  const camel = kebabToCamel(decl.name);
  const isExport = decl.clauses.some((c) => c.key === 'export');
  const applies = decl.clauses.find((c) => c.key === 'appliesto');
  const params = decl.clauses.find((c) => c.key === 'params');
  const appliesArr = applies?.items ? `[${applies.items.map((s) => sq(s)).join(', ')}]` : '[]';
  const paramsObj = params?.params ? emitParamsSchema(params.params) : '{}';
  const handlers = emitTraitHandlers(decl.members);
  const props = emitTraitProps(decl.members);
  const extra: string[] = [];
  const ext = extendsRef(decl); if (ext) extra.push(ext);
  const off = offMap(decl.members, 'event'); if (off) extra.push(off);
  const extraStr = extra.length ? `,\n  ${extra.join(',\n  ')}` : '';
  return `${isExport ? 'export ' : ''}const ${camel} = defineTrait(${sq(decl.name)}, {
  appliesTo: ${appliesArr},
  paramsSchema: ${paramsObj},
  props: ${props},
  handlers: ${handlers}${extraStr},
});
`;
}

function emitFilterTransformers(members: Member[], inputType: string): string {
  const list = members.filter((m) => m.kind === 'transform');
  const items = list.map((m) => {
    const nameField = m.name ? sq(m.name) : 'null';
    return `{ name: ${nameField}, run(this: any, v: ${inputType}) {${m.body ?? ''}\n} }`;
  });
  return `[${items.join(', ')}]`;
}

function emitFilterDecl(decl: Declaration): string {
  const camel = kebabToCamel(decl.name);
  const isExport = decl.clauses.some((c) => c.key === 'export');
  const input = decl.clauses.find((c) => c.key === 'input')?.value ?? 'string';
  const output = decl.clauses.find((c) => c.key === 'output')?.value ?? 'string';
  const params = decl.clauses.find((c) => c.key === 'params');
  const paramsObj = params?.params ? emitParamsSchema(params.params) : '{}';
  const transformers = emitFilterTransformers(decl.members, input);
  const extra: string[] = [];
  const ext = extendsRef(decl); if (ext) extra.push(ext);
  const off = offMap(decl.members, 'transform'); if (off) extra.push(off);
  const extraStr = extra.length ? `,\n  ${extra.join(',\n  ')}` : '';
  return `${isExport ? 'export ' : ''}const ${camel} = defineFilter(${sq(decl.name)}, {
  input: ${sq(input)},
  output: ${sq(output)},
  paramsSchema: ${paramsObj},
  transformers: ${transformers}${extraStr},
});
`;
}

function emitTokenDecl(decl: Declaration): string {
  const camel = kebabToCamel(decl.name);
  const isExport = decl.clauses.some((c) => c.key === 'export');
  const typeClause = decl.clauses.find((c) => c.key !== 'export' && c.key !== 'extends');
  const typeName = typeClause?.value ?? typeClause?.key ?? 'unknown';
  const clause = decl.clauses.find((c) => c.key === 'extends');
  const opts = clause?.items && clause.items.length
    ? `, { extends: [${clause.items.map((n) => kebabToCamel(n)).join(', ')}] }`
    : '';
  return `${isExport ? 'export ' : ''}const ${camel} = createToken<${typeName}>(${sq(decl.name)}${opts});\n`;
}

interface RouteClauses {
  layout?: string;
  guards: string[];
  status?: string;
  priority?: string;
}

// Parses `key=value` clauses: layout=X, guard=Y, guards=[a,b], status=N, priority=N.
function parseClauses(tokens: string[], into: RouteClauses): void {
  for (const tok of tokens) {
    const eq = tok.indexOf('=');
    if (eq === -1) continue;
    const key = tok.slice(0, eq);
    const val = tok.slice(eq + 1);
    if (key === 'layout') into.layout = kebabToCamel(val);
    else if (key === 'guard') into.guards.push(kebabToCamel(val));
    else if (key === 'guards') {
      for (const g of val.replace(/^\[|\]$/g, '').split(',')) {
        if (g.trim()) into.guards.push(kebabToCamel(g.trim()));
      }
    } else if (key === 'status') into.status = val;
    else if (key === 'priority') into.priority = val;
  }
}

// Parses a `{ id: string, page: int? default(1) }` param block into schema entries.
function parseParamBlock(block: string): string[] {
  const inner = block.replace(/^\{|\}$/g, '').trim();
  if (!inner) return [];
  return inner.split(',').map((raw) => {
    const seg = raw.trim();
    const m = /^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z]+)(\??)\s*(?:default\(([^)]*)\))?$/.exec(seg);
    if (!m) return `${sq(seg)}: { type: "string", optional: false }`;
    const [, name, type, opt, def] = m;
    const parts = [`type: ${sq(type)}`, `optional: ${opt ? 'true' : 'false'}`];
    if (def !== undefined) parts.push(`default: ${def}`);
    return `${sq(name)}: { ${parts.join(', ')} }`;
  });
}

// A route line: "<path>" [clauses] -> <Handler> [clauses] [{ params }]
function parseRouteLine(line: string, group: RouteClauses): string | null {
  let rest = line.trim();
  const pathM = /^"([^"]*)"\s*/.exec(rest);
  if (!pathM) return null;
  const path = pathM[1];
  rest = rest.slice(pathM[0].length);

  // Trailing param block.
  let paramBlock = '';
  const braceM = /\{[^}]*\}\s*$/.exec(rest);
  if (braceM) { paramBlock = braceM[0].trim(); rest = rest.slice(0, braceM.index); }

  const arrow = rest.split('->');
  const preTokens = arrow[0].trim().split(/\s+/).filter(Boolean);
  const post = (arrow[1] ?? '').trim().split(/\s+/).filter(Boolean);
  const handler = post.shift();
  if (!handler) return null;

  const clauses: RouteClauses = {
    layout: group.layout,
    guards: [...group.guards],
    status: group.status,
    priority: group.priority,
  };
  parseClauses(preTokens, clauses);
  parseClauses(post, clauses);

  const schema = parseParamBlock(paramBlock);
  const schemaStr = schema.length ? `{ ${schema.join(', ')} }` : '{}';
  const meta = clauses.layout ? `{ layout: ${clauses.layout} }` : '{}';
  return `{ path: ${sq(path)}, handler: ${kebabToCamel(handler)}, paramsSchema: ${schemaStr}, priority: ${clauses.priority ?? '50'}, guards: [${clauses.guards.join(', ')}], status: ${clauses.status ?? 'null'}, meta: ${meta} }`;
}

// `router` verb → default-exported RouteEntry[] (REQ-09 §9.2, REQ-11 §11.1).
function emitRouterDecl(decl: Declaration): string {
  const routesMember = decl.members.find((m) => m.kind === 'routes');
  const entries: string[] = [];
  let group: RouteClauses = { guards: [] };
  for (const raw of (routesMember?.body ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('group')) {
      group = { guards: [] };
      parseClauses(line.slice('group'.length).trim().split(/\s+/).filter(Boolean), group);
      continue;
    }
    if (line.startsWith('end group')) { group = { guards: [] }; continue; }
    const entry = parseRouteLine(line, group);
    if (entry) entries.push(`  ${entry},`);
  }
  return `export default [\n${entries.join('\n')}\n];\n`;
}

function emitProvideDecl(decl: Declaration): string {
  const tokenName = kebabToCamel(decl.name);
  const defaultMember = decl.members.find((m) => m.kind === 'default');
  const providerBody = defaultMember?.body ?? '';
  return `registry.provide(${tokenName}, function() {${providerBody}\n});\n`;
}

function emitImport(imp: ImportStatement, opts: SpecifierOptions): string {
  // Bare `import name` (no from) → side-effect import, resolved as a dtx specifier.
  if (imp.from === null) {
    const first = imp.items[0]?.source ?? '';
    return `import ${sq(resolveSpecifier(first, opts))};\n`;
  }
  const spec = resolveSpecifier(imp.from, opts);
  if (imp.namespace) return `import * as ${imp.namespace} from ${sq(spec)};\n`;
  if (imp.items.length === 0) return `import ${sq(spec)};\n`;
  const names = imp.items.map((it) => {
    const src = kebabToCamel(it.source);
    const alias = it.alias ? kebabToCamel(it.alias) : undefined;
    return alias ? `${src} as ${alias}` : src;
  }).join(', ');
  return `import { ${names} } from ${sq(spec)};\n`;
}

function addTemplateHelpers(needed: Set<string>): void {
  for (const n of ['__el', '__text', '__bind', '__bindField', '__use', '__if', '__for', '__virtualFor', '__case', '__ref', '__fragment', 'CASE_DEFAULT']) {
    needed.add(n);
  }
}

function collectImports(ast: DtxAst): Set<string> {
  const needed = new Set<string>();
  for (const decl of ast.declarations) {
    if (decl.verb === 'trait') needed.add('defineTrait');
    if (decl.verb === 'filter') needed.add('defineFilter');
    if (decl.verb === 'token') needed.add('createToken');
    if (decl.verb === 'provide') needed.add('registry');
    if (decl.verb === 'component') {
      needed.add('defineComponent');
      addTemplateHelpers(needed);
    }
  }
  for (const d of ast.declares ?? []) {
    if (d.kind === 'tpl' || d.kind === 'template') addTemplateHelpers(needed);
  }
  return needed;
}

function emitDeclare(d: DeclareDecl): string {
  const camel = kebabToCamel(d.name);
  const kind = d.kind === 'tpl' ? 'template' : d.kind;
  if (kind === 'template') {
    const ast = transformDirectives(parseTemplate(d.body));
    const body = codegen(ast);
    return `export const ${camel} = (ctx) => ${body};\n`;
  }
  if (kind === 'style') {
    return `export const ${camel} = ${sq(d.body)};\n`;
  }
  if (kind === 'props') {
    const names: string[] = [];
    for (const line of d.body.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) names.push(parts[1]);
    }
    return `export const ${camel} = ${JSON.stringify(names)};\n`;
  }
  if (kind === 'script' || kind === 'actions' || kind === 'effects') {
    return `export function ${camel}(ctx) {\n${d.body}\n}\n`;
  }
  return `export const ${camel} = ${sq(d.body)};\n`;
}

export function emitDtx(ast: DtxAst, opts: SpecifierOptions = {}): { code: string } {
  const runtimeImports = collectImports(ast);
  const lines: string[] = [];
  for (const name of runtimeImports) {
    lines.push(`import { ${name} } from ${sq(RUNTIME_MODULE)};`);
  }
  for (const imp of ast.imports) lines.push(emitImport(imp, opts).trimEnd());
  lines.push('');
  for (const d of ast.declares ?? []) lines.push(emitDeclare(d));
  for (const decl of ast.declarations) {
    if (decl.verb === 'trait') lines.push(emitTraitDecl(decl));
    else if (decl.verb === 'filter') lines.push(emitFilterDecl(decl));
    else if (decl.verb === 'token') lines.push(emitTokenDecl(decl));
    else if (decl.verb === 'provide') lines.push(emitProvideDecl(decl));
    else if (decl.verb === 'router') lines.push(emitRouterDecl(decl));
    else if (decl.verb === 'component') lines.push(emitComponent(decl));
  }
  return { code: lines.join('\n') };
}

export function compileDtxSource(source: string, opts: SpecifierOptions = {}): { code: string; map: string } {
  const ast = parseDtx(source);
  const { code } = emitDtx(ast, opts);
  const map = JSON.stringify({ version: 3, sources: ['<dtx>'], names: [], mappings: '' });
  return { code, map };
}
