import { describe, expect, it } from 'vitest';
import { KNOWN_VERBS, completionsAt } from '../../packages/uidetox-lsp/src/server.js';

describe('LSP completions', () => {
  it('returns all verbs at top level', () => {
    const items = completionsAt('', 'top');
    expect(items.map((i) => i.label)).toEqual([...KNOWN_VERBS]);
    expect(items.every((i) => i.kind === 'verb')).toBe(true);
  });

  it('returns clauses in clause context', () => {
    const items = completionsAt('', 'clause');
    expect(items.some((i) => i.label === 'appliesto')).toBe(true);
  });

  it('returns HTML events in event context', () => {
    const items = completionsAt('', 'event');
    expect(items.some((i) => i.label === 'click')).toBe(true);
  });
});
