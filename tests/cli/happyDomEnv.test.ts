import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discover } from '../../src/cli/testRunner/discover.js';
import { runInHappyDom } from '../../src/cli/testRunner/happyDomEnv.js';

const SFC = `---
name: Todo
tag: app-todo
---

\`\`\`ts props
export type Props = { title: string };
\`\`\`

\`\`\`html template
<span>hi \${props.title ?? "x"}</span>
\`\`\`

\`\`\`ts test
it('renders title', async () => {
  document.body.innerHTML = '<app-todo title="Y"></app-todo>';
  await Promise.resolve();
  flushSync();
  const el = document.body.querySelector('app-todo');
  expect(el?.querySelector('span')?.textContent).toBe('hi Y');
});
\`\`\`
`;

describe('runInHappyDom()', () => {
  it('executes an emitted test module and reports pass/fail', async () => {
    const root = mkdtempSync(join(tmpdir(), 'uidetox-hd-'));
    const src = join(root, 'src');
    const cache = join(root, 'cache');
    const snapDir = join(root, 'snap');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'Todo.md'), SFC);
    const { modules } = await discover(src, cache);
    const result = await runInHappyDom(modules[0].cachePath, snapDir, false);
    expect(result.failed).toBe(0);
    expect(result.passed).toBe(1);
  });
});
