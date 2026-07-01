import { parseSfc } from './sfc.js';
import { parseTemplate } from './template/parse.js';
import { transformDirectives } from './template/transform.js';
import { codegen } from './template/codegen.js';

const RUNTIME_IMPORTS =
  'import { defineComponent, defineEmits, registry, createToken, __el, __text, __bind, __if, __for, __case, __fragment, CASE_DEFAULT } from "uidetox";';
const TESTING_IMPORTS =
  'import { it, describe, beforeEach, expect, capture, snapshot, pixel, axe, flushSync, getCollectedTree, runTree } from "uidetox/testing";';

const HAPPY_DOM_ROLES = new Set(['test', 'test:interaction', 'test:visual', 'test:a11y']);
const BROWSER_ROLES = new Set(['test:visual:pixel', 'test:a11y:browser']);

const PROP_LINE = /^\s*(\w+)\s*[?:]/;

function extractPropNames(propsBlock: string | undefined): string[] {
  if (!propsBlock) return [];
  const inTypeBlock = /Props\s*=\s*\{([\s\S]*?)\}/m.exec(propsBlock);
  if (!inTypeBlock) return [];
  const names: string[] = [];
  for (const line of inTypeBlock[1].split('\n')) {
    const m = PROP_LINE.exec(line);
    if (m) names.push(m[1]);
  }
  return names;
}

function readTag(fm: Record<string, unknown>): string {
  const tag = fm.tag;
  if (typeof tag !== 'string' || !tag.includes('-')) {
    throw new Error('SFC frontmatter must define a "tag" containing at least one hyphen');
  }
  return tag;
}

export interface TestCompileResult {
  modules: Array<{ kind: 'happy-dom' | 'browser'; js: string }>;
}

export function testCompile(source: string, fileLabel = 'component.md'): TestCompileResult | null {
  const sfc = parseSfc(source);
  const testBlocks = sfc.blocks.filter((b) => b.role.startsWith('test'));
  if (testBlocks.length === 0) return null;

  const tag = readTag(sfc.frontmatter);
  const template = sfc.blocks.find((b) => b.role === 'template');
  if (!template) throw new Error('SFC must contain an `html template` block');
  const script = sfc.blocks.find((b) => b.role === 'script');
  const style = sfc.blocks.find((b) => b.role === 'style');
  const props = sfc.blocks.find((b) => b.role === 'props');
  const fixtures = sfc.blocks.find((b) => b.role === 'fixtures');
  const mock = sfc.blocks.find((b) => b.role === 'mock');

  const ast = transformDirectives(parseTemplate(template.content));
  const templateBody = codegen(ast);
  const propNames = extractPropNames(props?.content);
  const styleField = style ? `,\n  style: ${JSON.stringify(style.content)}` : '';

  const preamble = `${RUNTIME_IMPORTS}
${TESTING_IMPORTS}

function boot(ctx) {
  const { props, host } = ctx;
${script?.content ?? ''}
  return ${templateBody};
}

defineComponent({
  tag: ${JSON.stringify(tag)},
  props: ${JSON.stringify(propNames)},
  boot${styleField}
});

const fixtures = ${fixtures ? fixtures.content : '{}'};

function __applyMocks() {
${mock?.content ?? '// no mocks'}
}
`;

  function wrap(role: string, body: string): string {
    return `describe(${JSON.stringify(`${fileLabel}:${role}`)}, () => {\n  beforeEach(__applyMocks);\n${body}\n});\n`;
  }

  const happyBlocks = testBlocks.filter((b) => HAPPY_DOM_ROLES.has(b.role));
  const browserBlocks = testBlocks.filter((b) => BROWSER_ROLES.has(b.role));

  const modules: TestCompileResult['modules'] = [];
  if (happyBlocks.length > 0) {
    const wrapped = happyBlocks.map((b) => wrap(b.role, b.content)).join('\n');
    modules.push({
      kind: 'happy-dom',
      js: `${preamble}
${wrapped}
export default async function () { return runTree(getCollectedTree()); }
`,
    });
  }
  if (browserBlocks.length > 0) {
    const wrapped = browserBlocks.map((b) => wrap(b.role, b.content)).join('\n');
    modules.push({
      kind: 'browser',
      js: `${preamble}
${wrapped}
export default async function () { return runTree(getCollectedTree()); }
`,
    });
  }
  return { modules };
}
