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
    const trimmed = lines[i].trim();
    const first = trimmed.split(/\s+/)[0];
    if (first === '') continue;
    if (DTX_SECTION_KEYWORDS.has(first)) break;
    const tokens = trimmed.split(/\s+/);
    // `<type>[?] <name> [default …]` — type is one token (no internal spaces),
    // e.g. `number`, `boolean?`, `"a"|"b"`, `Node[]`.
    let type = tokens[0];
    const optional = type.endsWith('?');
    if (optional) type = type.slice(0, -1);
    const name = tokens[1];
    if (!name) continue;
    // Known dtx keyword → TS; otherwise pass through verbatim (union / named type).
    const ts = DTX_TYPE[type] ?? type;
    fields.push(`  ${name}?: ${ts};`);
  }
  if (!fields.length) return `export type Props = Record<string, never>;`;
  return `export type Props = {\n${fields.join('\n')}\n};`;
}

/** Collects top-level `import`/`import type` lines from a `.dtx` (for named prop types). */
function dtxImports(source: string): string[] {
  const out: string[] = [];
  for (const line of source.split('\n')) {
    const t = line.trim();
    if (/^import\s+type\s/.test(t) || /^import\s+\{/.test(t)) out.push(t);
    else if (t && !/^import\b/.test(t) && !/^\/\//.test(t)) {
      // Stop at the first non-import, non-comment, non-blank line (declarations start).
      if (/^(component|trait|filter|token|provide|router)\b/.test(t)) break;
    }
  }
  return out;
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

/** Adds `: unknown` to any unannotated parameter (§11.4). */
function normalizeParams(params: string): string {
  if (!params.trim()) return '';
  return params
    .split(',')
    .map((p) => {
      const seg = p.trim();
      if (!seg || seg.includes(':')) return seg;
      return `${seg}: unknown`;
    })
    .join(', ');
}

/** Extracts `actions` method signatures, preserving TS param/return annotations. */
function actionSignatures(source: string): string[] {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => l.trim().split(/\s+/)[0] === 'actions');
  if (start === -1) return [];
  const STOP = new Set(['end', 'template', 'tpl', 'script', 'effects', 'props', 'style', 'task', 'routes', 'component', 'trait', 'filter', 'token', 'provide', 'router', 'declare', 'import']);
  const sigs: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const first = lines[i].trim().split(/\s+/)[0];
    if (STOP.has(first)) break;
    const fn = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*(?::\s*([^{]+?))?\s*\{/.exec(lines[i]);
    if (fn) {
      const [, name, params, ret] = fn;
      sigs.push(`${name}(${normalizeParams(params)}): ${ret ? ret.trim() : 'unknown'}`);
    }
  }
  return sigs;
}

export interface ElementInterface {
  tag: string;
  name: string;
  /** Declaration text: the interface + HTMLElementTagNameMap augmentation. */
  decl: string;
}

/** A valid custom-element tag: lowercase, at least one hyphen (`**`, `//`, `:id` are not). */
function isCustomElementName(tag: string): boolean {
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(tag);
}

/** True when the source declares a top-level `router` verb. */
export function isRouterSource(source: string): boolean {
  return /^\s*router\s+\S+/m.test(source);
}

/** Builds a per-component element interface exposing `actions` as host methods (§9.4). */
export function generateElementInterface(id: string, source: string): ElementInterface | null {
  const tag = extractTag(id, source);
  // Guard against non-element tags (route patterns like `**`/`:id`) producing
  // garbage TS interfaces (REQ-26).
  if (!tag || !isCustomElementName(tag)) return null;
  const name = `${pascal(tag)}Element`;
  const methods = actionSignatures(source).map((s) => `  ${s};`);
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
  // A `router`-verb .dtx default-exports a RouteEntry[] (REQ-25), not a component.
  if (id.endsWith('.dtx') && isRouterSource(source)) {
    const constKw = opts.ambient ? 'const' : 'declare const';
    return [
      '// AUTO-GENERATED shim for a UIDetox router. Do not edit.',
      'import type { RouteEntry } from "ui-detox";',
      `${constKw} _default: RouteEntry[];`,
      'export default _default;',
      '',
    ].join('\n');
  }
  let propsDecl: string;
  if (id.endsWith('.md')) {
    const t = mdPropsType(source);
    propsDecl = t ?? 'export type Props = Record<string, unknown>;';
  } else {
    propsDecl = dtxPropsType(source) ?? 'export type Props = Record<string, unknown>;';
  }
  // In an ambient `declare module { … }` block, `const` is already ambient.
  const constKw = opts.ambient ? 'const' : 'declare const';
  const imports = id.endsWith('.md') ? [] : dtxImports(source);
  return [
    '// AUTO-GENERATED shim for a UIDetox component. Do not edit.',
    ...imports,
    propsDecl.startsWith('export') ? propsDecl : `export ${propsDecl}`,
    `${constKw} _default: (props?: Props) => HTMLElement;`,
    'export default _default;',
    '',
  ].join('\n');
}
