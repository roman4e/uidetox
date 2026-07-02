import { dirname, resolve as resolvePath } from 'node:path';
import { parseSfc } from '../sfc.js';
import { parseTemplate } from './parse.js';
import { IncludeResolver } from './fs.js';
import type { TplAttr, TplElement, TplNode } from './ast.js';

function attrOf(node: TplElement, name: string): TplAttr | undefined {
  return node.attrs.find((a) => a.name === name);
}

function sfcTemplateNodes(raw: string): TplNode[] {
  const sfc = parseSfc(raw);
  const template = sfc.blocks.find((b) => b.role === 'template');
  if (!template) throw new Error('included .md has no `html template` block');
  return parseTemplate(template.content);
}

function resolveOne(node: TplElement, baseDir: string, resolver: IncludeResolver): TplNode[] {
  const src = attrOf(node, 'src');
  if (!src) throw new Error('<include> requires src=');
  if (src.kind !== 'static') throw new Error('<include src> must be a static string literal');
  const absPath = resolvePath(baseDir, src.value);
  resolver.enter(absPath);
  try {
    const raw = resolver.read(absPath);
    const nodes = absPath.endsWith('.md') ? sfcTemplateNodes(raw) : parseTemplate(raw);
    return resolveIncludes(nodes, dirname(absPath), resolver);
  } finally {
    resolver.leave(absPath);
  }
}

export function resolveIncludes(
  ast: TplNode[],
  baseDir: string,
  resolver: IncludeResolver = new IncludeResolver(),
): TplNode[] {
  const out: TplNode[] = [];
  for (const node of ast) {
    if (node.type === 'element' && node.tag === 'include') {
      out.push(...resolveOne(node, baseDir, resolver));
      continue;
    }
    if (node.type === 'element') {
      out.push({ ...node, children: resolveIncludes(node.children, baseDir, resolver) });
      continue;
    }
    out.push(node);
  }
  return out;
}
