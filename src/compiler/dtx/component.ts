import { parseTemplate } from '../template/parse.js';
import { transformDirectives } from '../template/transform.js';
import { codegen } from '../template/codegen.js';
import type { Declaration } from './types.js';

function sq(v: string): string { return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`; }

function propNames(decl: Declaration): string[] {
  const clause = decl.clauses.find((c) => c.key === 'props');
  if (!clause?.params) return [];
  return clause.params.map((p) => p.name);
}

export function emitComponent(decl: Declaration): string {
  const tagClause = decl.clauses.find((c) => c.key === 'tag');
  const tag = tagClause?.value ?? decl.name.toLowerCase();
  const isExport = decl.clauses.some((c) => c.key === 'export');
  const template = decl.members.find((m) => m.kind === 'template');
  const style = decl.members.find((m) => m.kind === 'style');
  const actions = decl.members.find((m) => m.kind === 'actions');
  const effects = decl.members.find((m) => m.kind === 'effects');

  const templateSource = template?.body ?? '<div/>';
  const ast = transformDirectives(parseTemplate(templateSource));
  const templateBody = codegen(ast);

  const bootLines: string[] = [
    '  const { props, host } = ctx;',
  ];
  if (actions?.body) bootLines.push(`  ${actions.body.trim()}`);
  if (effects?.body) bootLines.push(`  ${effects.body.trim()}`);
  bootLines.push(`  return ${templateBody};`);

  const styleField = style ? `,\n  style: ${sq(style.body ?? '')}` : '';
  return `${isExport ? 'export ' : ''}const ${decl.name} = defineComponent({
  tag: ${sq(tag)},
  props: ${JSON.stringify(propNames(decl))},
  boot: (ctx) => {
${bootLines.join('\n')}
  }${styleField}
});
`;
}
