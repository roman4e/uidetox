import { parseSfc, type Sfc } from './sfc.js';
import { parseTemplate } from './template/parse.js';
import { transformDirectives } from './template/transform.js';
import { codegen } from './template/codegen.js';

const RUNTIME_IMPORTS =
  'import { defineComponent, __el, __text, __bind, __if, __for, __case, __fragment, CASE_DEFAULT } from "uidetox";';

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

function readTag(sfc: Sfc): string {
  const tag = sfc.frontmatter.tag;
  if (typeof tag !== 'string' || !tag.includes('-')) {
    throw new Error('SFC frontmatter must define a "tag" containing at least one hyphen');
  }
  return tag;
}

export function compile(source: string): { js: string; tag: string } {
  const sfc = parseSfc(source);
  const tag = readTag(sfc);
  const template = sfc.blocks.find((b) => b.role === 'template');
  if (!template) throw new Error('SFC must contain an `html template` block');
  const script = sfc.blocks.find((b) => b.role === 'script');
  const style = sfc.blocks.find((b) => b.role === 'style');
  const props = sfc.blocks.find((b) => b.role === 'props');

  const ast = transformDirectives(parseTemplate(template.content));
  const templateBody = codegen(ast);

  const propNames = extractPropNames(props?.content);

  const styleField = style ? `,\n  style: ${JSON.stringify(style.content)}` : '';

  const js = `${RUNTIME_IMPORTS}

function setup(ctx) {
  const { props, host } = ctx;
${script?.content ?? ''}
  return {};
}

function template(ctx) {
  const { props, host } = ctx;
  return ${templateBody};
}

defineComponent({
  tag: ${JSON.stringify(tag)},
  props: ${JSON.stringify(propNames)},
  setup,
  template${styleField}
});
`;

  return { js, tag };
}
