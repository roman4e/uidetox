import { parseTemplate } from '../template/parse.js';
import { transformDirectives } from '../template/transform.js';
import { codegen } from '../template/codegen.js';
import type { Declaration } from './types.js';

function sq(v: string): string { return JSON.stringify(v); }

const PROP_TOKEN = /(?:^|[;,\n])\s*(?:\w+\??\s+)?(\w+)/;

function propNames(decl: Declaration): string[] {
  // Params clause form: props (number start, string? label)
  const clause = decl.clauses.find((c) => c.key === 'props');
  if (clause?.params) return clause.params.map((p) => p.name);
  // Section form: props\n number start\n string? label
  const section = decl.members.find((m) => m.kind === 'props');
  if (section?.body) {
    const names: string[] = [];
    for (const line of section.body.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      // "<type>[?] <name> [default]" — take the second word
      const parts = t.split(/\s+/);
      if (parts.length >= 2) names.push(parts[1]);
    }
    return names;
  }
  return [];
}

/** Collect top-level `function <name>(...)` names from an actions body. */
function actionNames(body: string): string[] {
  const names: string[] = [];
  const rx = /\bfunction\s+(\w+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(body)) !== null) names.push(m[1]);
  return names;
}

export function emitComponent(decl: Declaration, emitDefault = true): string {
  const tagClause = decl.clauses.find((c) => c.key === 'tag');
  const tag = tagClause?.value ?? decl.name.toLowerCase();
  const isExport = decl.clauses.some((c) => c.key === 'export');
  const template = decl.members.find((m) => m.kind === 'template');
  const style = decl.members.find((m) => m.kind === 'style');
  const script = decl.members.find((m) => m.kind === 'script');
  const actions = decl.members.find((m) => m.kind === 'actions');
  const effects = decl.members.find((m) => m.kind === 'effects');
  const tasks = decl.members.filter((m) => m.kind === 'task');

  const templateSource = template?.body ?? '<div/>';
  const ast = transformDirectives(parseTemplate(templateSource));
  const templateBody = codegen(ast);

  const bootLines: string[] = [
    '  const { props, host, refs, ref, find, findAll, effect, emit, registry, task, onCleanup, readFrame } = ctx;',
  ];
  // script — private boot statements
  if (script?.body) bootLines.push(`  ${script.body.trim()}`);
  // actions — public methods (defined, then attached to host below)
  if (actions?.body) bootLines.push(`  ${actions.body.trim()}`);
  // Build the template first so refs are populated before effects run.
  bootLines.push(`  const __tpl = ${templateBody};`);
  if (effects?.body) bootLines.push(`  ${effects.body.trim()}`);
  // Detached async tasks — each wrapped in ctx.task (auto-disposed on unmount).
  for (const t of tasks) {
    const idle = t.idle ? ', { idle: true }' : '';
    bootLines.push(`  task(async (signal) => {\n${t.body ?? ''}\n  }${idle});`);
  }
  // Attach actions to the host as the imperative public API.
  if (actions?.body) {
    for (const name of actionNames(actions.body)) {
      bootLines.push(`  host.${name} = ${name};`);
    }
  }
  bootLines.push('  return __tpl;');

  const styleField = style ? `,\n  style: ${sq(style.body ?? '')}` : '';
  // Default export: a route/handler factory that instantiates the element and
  // reflects the matched route params (typed) onto it before boot (REQ-18).
  // Importing the module also registers the custom element (defineComponent side effect).
  // A module can hold at most one `export default`, so only the file's primary
  // (first) component emits it; secondary components in the same file are still
  // registered via the `defineComponent` side effect and reachable by tag/name.
  const defaultExport = emitDefault
    ? `
export default (ctx) => {
  const __el = document.createElement(${sq(tag)});
  if (ctx && ctx.params) {
    __el.__uidetoxParams = ctx.params;
    for (const __k in ctx.params) {
      const __v = ctx.params[__k];
      if (__v !== undefined && __v !== null) __el.setAttribute(__k, String(__v));
    }
  }
  return __el;
};
`
    : '';
  return `${isExport ? 'export ' : ''}const ${decl.name} = defineComponent({
  tag: ${sq(tag)},
  props: ${JSON.stringify(propNames(decl))},
  boot: (ctx) => {
${bootLines.join('\n')}
  }${styleField}
});
${defaultExport}`;
}
