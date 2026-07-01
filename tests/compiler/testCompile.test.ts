import { describe, expect, it } from 'vitest';
import { testCompile } from '../../src/compiler/testCompile.js';

const SFC = `---
name: Todo
tag: app-todo
---

\`\`\`html template
<span>hi</span>
\`\`\`

\`\`\`json fixtures
{ "one": { "id": "1" } }
\`\`\`

\`\`\`ts mock
// noop
\`\`\`

\`\`\`ts test
it('passes', () => { expect(1).toBe(1); });
\`\`\`

\`\`\`ts test:visual:pixel
pixel('default', fixtures.one);
\`\`\`
`;

describe('testCompile()', () => {
  it('returns null when no test* blocks are present', () => {
    const noTests = SFC.replace(/```ts test[\s\S]*?```/g, '');
    expect(testCompile(noTests)).toBeNull();
  });

  it('emits a happy-dom module for fast blocks and a browser module for pixel blocks', () => {
    const result = testCompile(SFC, 'todo.md')!;
    expect(result.modules).toHaveLength(2);
    const happyDom = result.modules.find((m) => m.kind === 'happy-dom')!;
    const browser = result.modules.find((m) => m.kind === 'browser')!;
    expect(happyDom.js).toContain('const fixtures = { "one": { "id": "1" } };');
    expect(happyDom.js).toContain('function __applyMocks()');
    expect(happyDom.js).toContain(`describe("todo.md:test"`);
    expect(happyDom.js).toContain('runTree(getCollectedTree())');
    expect(browser.js).toContain(`describe("todo.md:test:visual:pixel"`);
    expect(browser.js).not.toContain(`describe("todo.md:test"`);
  });
});
