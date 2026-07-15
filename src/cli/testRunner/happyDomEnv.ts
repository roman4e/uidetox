import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import type { RunResult } from '../../testing/run.js';

const PROJECT_ROOT = resolve(process.cwd());
const RUNTIME_PATH = resolve(PROJECT_ROOT, 'src/runtime/index.ts');
const TESTING_PATH = resolve(PROJECT_ROOT, 'src/testing/index.ts');
const TSX_BIN = resolve(PROJECT_ROOT, 'node_modules/.bin/tsx');
const require = createRequire(resolve(PROJECT_ROOT, 'package.json'));
const HAPPY_DOM_ENTRY = require.resolve('happy-dom');

function rewriteImports(src: string): string {
  return src
    .replace(/from ["']ui-detox\/testing["']/g, `from "${TESTING_PATH}"`)
    .replace(/from ["']ui-detox["']/g, `from "${RUNTIME_PATH}"`);
}

const HARNESS_TEMPLATE = (stagedPath: string, componentDir: string, updateMode: boolean) => `
import { Window } from ${JSON.stringify(HAPPY_DOM_ENTRY)};
const window = new Window({ url: 'http://uidetox.local/' });
const keys = ['window','document','HTMLElement','Element','Node','CustomEvent','Event','customElements'];
for (const k of keys) globalThis[k] = window[k];
const { configureSnapshots } = await import(${JSON.stringify(TESTING_PATH)});
configureSnapshots({ componentDir: ${JSON.stringify(componentDir)}, updateMode: ${JSON.stringify(updateMode)} });
const mod = await import(${JSON.stringify('file://' + stagedPath)});
const result = await mod.default();
process.stdout.write('__UIDETOX_RESULT__' + JSON.stringify(result) + '__END__');
`;

async function stageModule(cachePath: string): Promise<string> {
  const original = await readFile(cachePath, 'utf8');
  const staged = rewriteImports(original);
  const stagedPath = cachePath.replace(/\.mjs$/, '.staged.mjs');
  await mkdir(dirname(stagedPath), { recursive: true });
  await writeFile(stagedPath, staged, 'utf8');
  return stagedPath;
}

async function runHarness(harnessPath: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(TSX_BIN, [harnessPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`happy-dom runner exited with code ${code}: ${stderr}`));
        return;
      }
      const match = /__UIDETOX_RESULT__([\s\S]*?)__END__/.exec(stdout);
      if (!match) {
        reject(new Error(`no result marker in output. stdout=${stdout.slice(0, 400)} stderr=${stderr.slice(0, 400)}`));
        return;
      }
      resolve(JSON.parse(match[1]) as RunResult);
    });
  });
}

export async function runInHappyDom(
  cachePath: string,
  componentSnapshotDir: string,
  updateMode: boolean,
): Promise<RunResult> {
  const stagedPath = await stageModule(cachePath);
  const harness = HARNESS_TEMPLATE(stagedPath, componentSnapshotDir, updateMode);
  const harnessPath = stagedPath.replace(/\.staged\.mjs$/, '.harness.mjs');
  await writeFile(harnessPath, harness, 'utf8');
  return runHarness(harnessPath);
}
