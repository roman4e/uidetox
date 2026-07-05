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
