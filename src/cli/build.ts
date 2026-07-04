#!/usr/bin/env node
import { Command } from 'commander';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, relative } from 'node:path';
import { compile } from '../compiler/compile.js';
import { generateApiClient, type OpenApiDoc } from '../compiler/openapi/generate.js';

export interface BuildOptions {
  inputDir: string;
  outDir: string;
}

export interface OpenApiOptions {
  input: string;
  output: string;
}

export async function runOpenApi(options: OpenApiOptions): Promise<void> {
  const raw = await readFile(options.input, 'utf8');
  const doc = JSON.parse(raw) as OpenApiDoc;
  const code = generateApiClient(doc);
  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, code, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`generated API client → ${options.output}`);
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

export async function runBuild(options: BuildOptions): Promise<void> {
  const files = await walk(options.inputDir);
  await mkdir(options.outDir, { recursive: true });
  for (const rel of files) {
    const source = await readFile(join(options.inputDir, rel), 'utf8');
    const { js } = compile(source);
    const outPath = join(options.outDir, rel.replace(/\.md$/, '.js'));
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, js, 'utf8');
    // eslint-disable-next-line no-console
    console.log(`compiled ${rel} → ${basename(outPath)}`);
  }
}

const program = new Command();
program
  .name('uidetox')
  .command('build <inputDir>')
  .option('-o, --outDir <dir>', 'Output directory', 'dist')
  .action(async (inputDir: string, opts: { outDir: string }) => {
    await runBuild({ inputDir, outDir: opts.outDir });
  });

program
  .command('openapi')
  .requiredOption('-i, --input <file>', 'OpenAPI 3.1 JSON document')
  .requiredOption('-o, --output <file>', 'Output TypeScript client file')
  .action(async (opts: { input: string; output: string }) => {
    await runOpenApi({ input: opts.input, output: opts.output });
  });

if (process.argv[1]?.endsWith('build.ts') || process.argv[1]?.endsWith('build.js')) {
  program.parseAsync(process.argv);
}
