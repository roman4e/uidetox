import { describe, expect, it } from 'vitest';
import { resource } from '../../src/http/resource.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('resource.reload() invalidation (REQ-19a)', () => {
  it('unconditionally re-runs the fetcher and swaps .data (unchanged key)', async () => {
    let n = 0;
    const r = resource(async () => n++, { key: () => 'k' });
    await tick();
    expect(r.data).toBe(0);

    r.reload();
    await tick();
    expect(r.data).toBe(1);   // fresh run despite same key

    r.reload();
    await tick();
    expect(r.data).toBe(2);
    expect(r.status).toBe('success');
  });

  it('replaces (not appends) the data array on reload', async () => {
    const pages = [[{ id: 1 }], []]; // first fetch → 1 item, after mutate → 0
    let call = 0;
    const r = resource<Array<{ id: number }>>(async () => pages[call++] ?? [], {});
    await tick();
    expect(r.data).toHaveLength(1);

    r.reload();
    await tick();
    expect(r.data).toHaveLength(0); // replaced, not merged
  });
});
