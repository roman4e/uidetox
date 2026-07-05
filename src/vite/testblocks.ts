// Colocated test/fixture/mock blocks in a Markdown SFC are ignored by the core
// compiler (they never reach dev/build output). In `test` mode the Vite/esbuild
// plugin re-emits them as exports so a runner can execute them.

export interface TestBlock {
  role: string;   // 'test', 'test:visual', 'test:a11y', 'mock', 'fixtures'
  body: string;
}

const TEST_ROLES = /^(test(:[a-z-]+)?|mock|fixtures)$/;

/** Extracts test/mock/fixture fenced blocks from a `.md` SFC source. */
export function extractTestBlocks(id: string, source: string): TestBlock[] {
  if (!id.endsWith('.md')) return [];
  const blocks: TestBlock[] = [];
  const fence = /```[A-Za-z][\w-]*\s+([A-Za-z][\w:-]*)\s*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(source)) !== null) {
    const role = m[1];
    if (TEST_ROLES.test(role)) blocks.push({ role, body: m[2].trim() });
  }
  return blocks;
}

/** JS appended in `test` mode: a `__tests()` callable plus any `__fixtures`/`__mocks`. */
export function emitTestExports(blocks: TestBlock[]): string {
  if (!blocks.length) return '';
  const tests = blocks.filter((b) => b.role.startsWith('test')).map((b) => b.body).join('\n\n');
  const parts: string[] = [];
  if (tests) parts.push(`export function __tests() {\n${tests}\n}`);
  const fixtures = blocks.filter((b) => b.role === 'fixtures').map((b) => b.body).join('\n');
  if (fixtures) parts.push(`export const __fixtures = ${fixtures || '{}'};`);
  return parts.length ? `\n${parts.join('\n')}\n` : '';
}
