import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  configureSnapshots,
  serializeDom,
  snapshot,
} from '../../src/testing/snapshot/structural.js';

describe('structural snapshots', () => {
  it('serializes DOM into a stable form', () => {
    document.body.innerHTML = '<section class="a" id="x"><span>hi</span></section>';
    const out = serializeDom(document.body);
    expect(out).toContain('<section class="a" id="x">');
    expect(out).toContain('<span>');
    expect(out).toContain('hi');
  });

  it('creates a baseline in update mode and matches next run', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'snap-'));
    mkdirSync(dir, { recursive: true });
    configureSnapshots({ componentDir: dir, updateMode: true });

    document.body.innerHTML = '<div>hello</div>';
    await snapshot('default');
    const written = readFileSync(join(dir, 'default.snap.txt'), 'utf8');
    expect(written).toContain('<div>');
    expect(written).toContain('hello');

    // second run, non-update, must pass because baseline exists
    configureSnapshots({ componentDir: dir, updateMode: false });
    await snapshot('default');
  });
});
