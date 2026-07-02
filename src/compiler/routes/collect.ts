import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parseSfc } from '../sfc.js';
import { parseTemplate } from '../template/parse.js';
import { transformRouterElement, type RouterAst } from './routerTransform.js';

export interface Discovered {
  file: string;
  routers: RouterAst[];
  imports: string[];
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry);
    const info = await stat(full);
    if (info.isDirectory()) out.push(...(await walk(full)));
    else if (entry === 'routes.md') out.push(full);
  }
  return out;
}

const IMPORT_LINE_RE = /^\s*import\s.+$/gm;

export async function discoverRoutes(inputDir: string): Promise<Discovered[]> {
  const files = await walk(inputDir);
  const out: Discovered[] = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const sfc = parseSfc(source);
    const template = sfc.blocks.find((b) => b.role === 'template');
    if (!template) continue;
    const script = sfc.blocks.find((b) => b.role === 'script');
    const imports: string[] = [];
    if (script) {
      const matches = script.content.match(IMPORT_LINE_RE);
      if (matches) for (const m of matches) imports.push(m.trim());
    }
    const ast = parseTemplate(template.content);
    const routers: RouterAst[] = [];
    for (const node of ast) {
      if (node.type === 'element' && (node.tag === 'Router' || node.tag === 'router')) {
        routers.push(transformRouterElement(node));
      }
    }
    out.push({ file, routers, imports });
  }
  return out;
}
