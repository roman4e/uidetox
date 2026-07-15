import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from '../../src/compiler/compile.js';
import { flushSync } from '../../src/runtime/scheduler.js';
import * as runtime from '../../src/runtime/index.js';
import { state } from '../../src/runtime/state.js';

/**
 * Runs an emitted UIDetox module by stripping its `import from "ui-detox"`
 * statement and evaluating the remaining code with the runtime helpers
 * injected as free variables. Safer than data-URL import + more predictable
 * inside happy-dom.
 */
function evalCompiledModule(js: string): void {
  const stripped = js
    .replace(/^import\s*\{[^}]+\}\s*from\s*"ui-detox";\s*\n?/m, '')
    // strip the ESM `export default` (the route-handler factory) for new Function eval
    .replace(/^export default /m, 'const __uidetoxDefault = ');
  const names = [
    'defineComponent',
    '__el',
    '__text',
    '__bind',
    '__if',
    '__for',
    '__case',
    '__fragment',
    'CASE_DEFAULT',
    'state',
  ] as const;
  const args = names.map((n) => (runtime as unknown as Record<string, unknown>)[n] ?? state);
  const fn = new Function(...names, stripped);
  fn(...args);
}

describe('hello world SFC', () => {
  it('compiles and boots in a happy-dom environment', async () => {
    const src = readFileSync(join(process.cwd(), 'examples/hello/App.md'), 'utf8');
    const { js } = compile(src);
    evalCompiledModule(js);

    document.body.innerHTML = '<app-root who="World"></app-root>';
    // let queued microtasks flush (for __if anchor renderIf attachment)
    await Promise.resolve();
    await Promise.resolve();
    flushSync();

    const root = document.body.querySelector('app-root')!;
    expect(root.querySelector('h1')?.textContent).toBe('Hello, World!');
    expect(root.textContent).toContain('The panel is open.');

    root.querySelector('button')!.click();
    flushSync();
    expect(root.textContent).toContain('The panel is closed.');
  });
});
