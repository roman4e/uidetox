import { kebabToCamel } from './namespace.js';
import { parseDtx } from './parse.js';
import type {
  Declaration,
  DtxAst,
  ImportStatement,
  Member,
  ParamSpec,
} from './types.js';

const RUNTIME_MODULE = 'uidetox';

function sq(v: unknown): string {
  if (typeof v !== 'string') return JSON.stringify(v);
  return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
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
  return `${isExport ? 'export ' : ''}const ${camel} = defineTrait(${sq(decl.name)}, {
  appliesTo: ${appliesArr},
  paramsSchema: ${paramsObj},
  props: ${props},
  handlers: ${handlers},
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
  return `${isExport ? 'export ' : ''}const ${camel} = defineFilter(${sq(decl.name)}, {
  input: ${sq(input)},
  output: ${sq(output)},
  paramsSchema: ${paramsObj},
  transformers: ${transformers},
});
`;
}

function emitTokenDecl(decl: Declaration): string {
  const camel = kebabToCamel(decl.name);
  const isExport = decl.clauses.some((c) => c.key === 'export');
  const typeName = decl.clauses.find((c) => c.key !== 'export')?.value ?? 'unknown';
  return `${isExport ? 'export ' : ''}const ${camel} = createToken<${typeName}>(${sq(decl.name)});\n`;
}

function emitProvideDecl(decl: Declaration): string {
  const tokenName = kebabToCamel(decl.name);
  const defaultMember = decl.members.find((m) => m.kind === 'default');
  const providerBody = defaultMember?.body ?? '';
  return `registry.provide(${tokenName}, function() {${providerBody}\n});\n`;
}

function emitImport(imp: ImportStatement): string {
  if (imp.items.length === 0) return `import ${sq(imp.path)};\n`;
  const names = imp.items.map((it) => {
    const src = kebabToCamel(it.source);
    const alias = it.alias ? kebabToCamel(it.alias) : undefined;
    return alias ? `${src} as ${alias}` : src;
  }).join(', ');
  return `import { ${names} } from ${sq(imp.path)};\n`;
}

function collectImports(ast: DtxAst): Set<string> {
  const needed = new Set<string>();
  for (const decl of ast.declarations) {
    if (decl.verb === 'trait') needed.add('defineTrait');
    if (decl.verb === 'filter') needed.add('defineFilter');
    if (decl.verb === 'token') needed.add('createToken');
    if (decl.verb === 'provide') needed.add('registry');
  }
  return needed;
}

export function emitDtx(ast: DtxAst): { code: string } {
  const runtimeImports = collectImports(ast);
  const lines: string[] = [];
  for (const name of runtimeImports) {
    lines.push(`import { ${name} } from '${RUNTIME_MODULE}';`);
  }
  for (const imp of ast.imports) lines.push(emitImport(imp).trimEnd());
  lines.push('');
  for (const decl of ast.declarations) {
    if (decl.verb === 'trait') lines.push(emitTraitDecl(decl));
    else if (decl.verb === 'filter') lines.push(emitFilterDecl(decl));
    else if (decl.verb === 'token') lines.push(emitTokenDecl(decl));
    else if (decl.verb === 'provide') lines.push(emitProvideDecl(decl));
  }
  return { code: lines.join('\n') };
}

export function compileDtxSource(source: string): { code: string; map: string } {
  const ast = parseDtx(source);
  const { code } = emitDtx(ast);
  const map = sq({ version: 3, sources: ['<dtx>'], names: [], mappings: '' });
  return { code, map };
}
