#!/usr/bin/env node
import { Command } from 'commander';
import { join } from 'node:path';
import { discover } from './testRunner/discover.js';
import { runInHappyDom } from './testRunner/happyDomEnv.js';
import { runInPlaywright } from './testRunner/playwrightEnv.js';
import { renderHuman, renderJson } from './testRunner/report.js';
import type { RunResult } from '../testing/run.js';

export interface TestOptions {
  inputDir: string;
  cacheDir?: string;
  snapshotsDir?: string;
  updateSnapshots?: boolean;
  filter?: string;
  only?: string;
  reporter?: 'human' | 'json';
}

export async function runTest(options: TestOptions): Promise<{ passed: number; failed: number; report: string }> {
  const cacheDir = options.cacheDir ?? join(options.inputDir, '..', '.uidetox', 'test-cache');
  const snapshotsDir = options.snapshotsDir ?? join(options.inputDir, '..', 'snapshots');
  const filter = options.filter ? new RegExp(options.filter) : null;
  const discovered = await discover(options.inputDir, cacheDir);

  const byFile: Record<string, RunResult> = {};
  for (const mod of discovered.modules) {
    if (filter && !filter.test(mod.sfcPath)) continue;
    const componentName = mod.sfcPath.replace(/^.*\//, '').replace(/\.md$/, '');
    const componentSnapDir = join(snapshotsDir, componentName);
    const key = `${mod.sfcPath}:${mod.kind}`;
    if (mod.kind === 'happy-dom') {
      byFile[key] = await runInHappyDom(mod.cachePath, componentSnapDir, !!options.updateSnapshots);
    } else {
      byFile[key] = await runInPlaywright(mod.cachePath, componentSnapDir, !!options.updateSnapshots);
    }
  }
  const passed = Object.values(byFile).reduce((a, r) => a + r.passed, 0);
  const failed = Object.values(byFile).reduce((a, r) => a + r.failed, 0);
  const report = options.reporter === 'json' ? renderJson(byFile) : renderHuman(byFile);
  return { passed, failed, report };
}

const program = new Command();
program
  .name('ui-detox')
  .command('test <inputDir>')
  .option('-o, --out <dir>', 'Cache directory for compiled test modules')
  .option('-s, --snapshots <dir>', 'Directory to read/write baselines')
  .option('-u, --update-snapshots', 'Write missing / mismatched baselines')
  .option('-f, --filter <regex>', 'Only run SFCs whose path matches')
  .option('--only <role>', 'Run only blocks of this role')
  .option('--reporter <format>', 'Reporter (human|json)', 'human')
  .action(async (inputDir: string, opts: { out?: string; snapshots?: string; updateSnapshots?: boolean; filter?: string; only?: string; reporter?: 'human' | 'json' }) => {
    const result = await runTest({
      inputDir,
      cacheDir: opts.out,
      snapshotsDir: opts.snapshots,
      updateSnapshots: opts.updateSnapshots,
      filter: opts.filter,
      only: opts.only,
      reporter: opts.reporter,
    });
    process.stdout.write(result.report + '\n');
    process.exit(result.failed === 0 ? 0 : 1);
  });

if (process.argv[1]?.endsWith('test.ts') || process.argv[1]?.endsWith('test.js')) {
  program.parseAsync(process.argv);
}
