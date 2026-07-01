import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { testCompile } from '../../compiler/testCompile.js';

export interface DiscoveredModule {
  sfcPath: string;
  kind: 'happy-dom' | 'browser';
  cachePath: string;
}

export interface Discovered {
  modules: DiscoveredModule[];
}

async function walk(dir: string, root = dir): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry);
    const info = await stat(full);
    if (info.isDirectory()) out.push(...(await walk(full, root)));
    else if (extname(full) === '.md') out.push(relative(root, full));
  }
  return out;
}

export async function discover(inputDir: string, cacheDir: string): Promise<Discovered> {
  const rels = await walk(inputDir);
  await mkdir(cacheDir, { recursive: true });
  const modules: DiscoveredModule[] = [];
  for (const rel of rels) {
    const sfcPath = join(inputDir, rel);
    const source = await readFile(sfcPath, 'utf8');
    const compiled = testCompile(source, rel);
    if (!compiled) continue;
    for (const mod of compiled.modules) {
      const cacheRel = rel.replace(/\.md$/, `.${mod.kind}.test.mjs`);
      const cachePath = join(cacheDir, cacheRel);
      await mkdir(dirname(cachePath), { recursive: true });
      await writeFile(cachePath, mod.js, 'utf8');
      modules.push({ sfcPath, kind: mod.kind, cachePath });
    }
  }
  return { modules };
}
