// Generates a virtual TypeScript shim for a compiled component so `tsc --noEmit`
// sees the same symbols an `import` of the `.dtx`/`.md` file provides.

const DTX_TYPE: Record<string, string> = {
  number: 'number',
  string: 'string',
  boolean: 'boolean',
  array: 'unknown[]',
  object: 'Record<string, unknown>',
};

const DTX_SECTION_KEYWORDS = new Set([
  'end', 'template', 'tpl', 'script', 'actions', 'effects', 'style', 'task',
  'component', 'trait', 'filter', 'token', 'provide', 'router', 'declare', 'import',
]);

function mdPropsType(source: string): string | null {
  const m = /```[A-Za-z][\w-]*\s+props\s*\n([\s\S]*?)```/.exec(source);
  return m ? m[1].trim() : null;
}

function dtxPropsType(source: string): string | null {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => l.trim().split(/\s+/)[0] === 'props');
  if (start === -1) return null;
  const fields: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const first = lines[i].trim().split(/\s+/)[0];
    if (first === '' ) continue;
    if (DTX_SECTION_KEYWORDS.has(first)) break;
    const [type, name] = lines[i].trim().split(/\s+/);
    if (!name) continue;
    fields.push(`  ${name}?: ${DTX_TYPE[type] ?? 'unknown'};`);
  }
  if (!fields.length) return `export type Props = Record<string, never>;`;
  return `export type Props = {\n${fields.join('\n')}\n};`;
}

function pascal(tag: string): string {
  return tag.replace(/(^|[-_])([a-z0-9])/g, (_m, _s, c: string) => c.toUpperCase());
}

function extractTag(id: string, source: string): string | null {
  if (id.endsWith('.md')) {
    const m = /^tag:\s*(\S+)/m.exec(source);
    return m ? m[1] : null;
  }
  const hdr = /\bcomponent\s+(\S+)([^\n]*)/.exec(source);
  if (!hdr) return null;
  const tagM = /\btag\s+(\S+)/.exec(hdr[2]);
  return tagM ? tagM[1] : hdr[1].toLowerCase();
}

function actionNames(source: string): string[] {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => l.trim().split(/\s+/)[0] === 'actions');
  if (start === -1) return [];
  const STOP = new Set(['end', 'template', 'tpl', 'script', 'effects', 'props', 'style', 'task', 'routes', 'component', 'trait', 'filter', 'token', 'provide', 'router', 'declare', 'import']);
  const names: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const first = lines[i].trim().split(/\s+/)[0];
    if (STOP.has(first)) break;
    const fn = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/.exec(lines[i]);
    if (fn) names.push(fn[1]);
  }
  return names;
}

export interface ElementInterface {
  tag: string;
  name: string;
  /** Declaration text: the interface + HTMLElementTagNameMap augmentation. */
  decl: string;
}

/** Builds a per-component element interface exposing `actions` as host methods (§9.4). */
export function generateElementInterface(id: string, source: string): ElementInterface | null {
  const tag = extractTag(id, source);
  if (!tag) return null;
  const name = `${pascal(tag)}Element`;
  const methods = actionNames(source).map((n) => `  ${n}(...args: unknown[]): unknown;`);
  const body = methods.length ? `\n${methods.join('\n')}\n` : '';
  // shims.d.ts is a script (only ambient `declare module` blocks), so top-level
  // interface declarations merge with the global lib.dom types directly.
  const decl =
    `interface ${name} extends HTMLElement {${body}}\n` +
    `interface HTMLElementTagNameMap {\n  ${JSON.stringify(tag)}: ${name};\n}`;
  return { tag, name, decl };
}

/** Returns TypeScript declarations for the component in `source` (id decides format). */
export function generateTsShim(id: string, source: string, opts: { ambient?: boolean } = {}): string {
  let propsDecl: string;
  if (id.endsWith('.md')) {
    const t = mdPropsType(source);
    propsDecl = t ?? 'export type Props = Record<string, unknown>;';
  } else {
    propsDecl = dtxPropsType(source) ?? 'export type Props = Record<string, unknown>;';
  }
  // In an ambient `declare module { … }` block, `const` is already ambient.
  const constKw = opts.ambient ? 'const' : 'declare const';
  return [
    '// AUTO-GENERATED shim for a UIDetox component. Do not edit.',
    propsDecl.startsWith('export') ? propsDecl : `export ${propsDecl}`,
    `${constKw} _default: (props?: Props) => HTMLElement;`,
    'export default _default;',
    '',
  ].join('\n');
}
