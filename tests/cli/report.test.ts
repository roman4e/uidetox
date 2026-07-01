import { describe, expect, it } from 'vitest';
import { renderHuman, renderJson } from '../../src/cli/testRunner/report.js';

const results = {
  'todo.md:happy-dom': {
    outcomes: [
      { path: 'todo.md:test > renders', ok: true, durationMs: 12 },
      { path: 'todo.md:test:a11y > has no violations', ok: false, durationMs: 5, error: 'boom' },
    ],
    passed: 1,
    failed: 1,
  },
};

describe('reporters', () => {
  it('human reporter includes file, block, count and failing message', () => {
    process.env.NO_COLOR = '1';
    const text = renderHuman(results);
    expect(text).toContain('todo.md');
    expect(text).toContain('happy-dom');
    expect(text).toContain('boom');
    expect(text).toContain('2 tests, 1 passed, 1 failed');
  });

  it('json reporter emits parseable JSON', () => {
    const parsed = JSON.parse(renderJson(results));
    expect(parsed['todo.md:happy-dom'].failed).toBe(1);
  });
});
