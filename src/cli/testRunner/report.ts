import type { RunResult } from '../../testing/run.js';

function isColorOff(): boolean {
  return !!process.env.NO_COLOR || !process.stdout.isTTY;
}

function color(code: string, text: string): string {
  return isColorOff() ? text : `\x1b[${code}m${text}\x1b[0m`;
}

const green = (t: string) => color('32', t);
const red = (t: string) => color('31', t);
const dim = (t: string) => color('2', t);

export function renderHuman(byFile: Record<string, RunResult>): string {
  const lines: string[] = [];
  let total = 0, passed = 0, failed = 0;
  for (const [file, result] of Object.entries(byFile)) {
    total += result.outcomes.length;
    passed += result.passed;
    failed += result.failed;
    const mark = result.failed === 0 ? green('✔') : red('✖');
    lines.push(`${mark} ${file}  ${dim(`(${result.outcomes.length} tests)`)}`);
    for (const o of result.outcomes) {
      if (!o.ok) lines.push(`  · ${red(o.path)}: ${o.error?.split('\n')[0] ?? ''}`);
    }
  }
  lines.push('');
  lines.push(`${total} tests, ${passed} passed, ${failed} failed`);
  return lines.join('\n');
}

export function renderJson(byFile: Record<string, RunResult>): string {
  return JSON.stringify(byFile, null, 2);
}
