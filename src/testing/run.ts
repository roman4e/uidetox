import type { Suite } from './collect.js';

export interface TestOutcome {
  path: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

export interface RunResult {
  outcomes: TestOutcome[];
  passed: number;
  failed: number;
}

function pathJoin(parts: string[]): string {
  return parts.filter((p) => p && p !== '__root__').join(' > ');
}

async function walk(
  suite: Suite,
  parents: string[],
  inheritedHooks: Array<() => void | Promise<void>>,
  outcomes: TestOutcome[],
): Promise<void> {
  const path = [...parents, suite.name];
  const hooks = [...inheritedHooks, ...suite.hooks.beforeEach];
  for (const t of suite.tests) {
    const testPath = pathJoin([...path, t.name]);
    const start = performance.now();
    let ok = true;
    let error: string | undefined;
    try {
      for (const h of hooks) await h();
      await t.fn();
    } catch (err) {
      ok = false;
      error = err instanceof Error ? err.stack ?? err.message : String(err);
    }
    outcomes.push({ path: testPath, ok, durationMs: performance.now() - start, error });
  }
  for (const child of suite.suites) {
    await walk(child, path, hooks, outcomes);
  }
}

export async function runTree(root: Suite): Promise<RunResult> {
  const outcomes: TestOutcome[] = [];
  await walk(root, [], [], outcomes);
  const passed = outcomes.filter((o) => o.ok).length;
  const failed = outcomes.length - passed;
  return { outcomes, passed, failed };
}
