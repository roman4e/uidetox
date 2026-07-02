import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IncludeCycleError, IncludeResolver } from '../../../src/compiler/template/fs.js';

describe('IncludeResolver', () => {
  it('reads and caches file contents', () => {
    const dir = mkdtempSync(join(tmpdir(), 'inc-'));
    const p = join(dir, 'a.html');
    writeFileSync(p, '<div>a</div>');
    const r = new IncludeResolver();
    expect(r.read(p)).toBe('<div>a</div>');
    writeFileSync(p, '<div>b</div>');
    expect(r.read(p)).toBe('<div>a</div>');
  });

  it('throws on cycle', () => {
    const r = new IncludeResolver();
    r.enter('/a');
    r.enter('/b');
    expect(() => r.enter('/a')).toThrow(IncludeCycleError);
  });

  it('leaves lets the same path enter again later', () => {
    const r = new IncludeResolver();
    r.enter('/a');
    r.leave('/a');
    expect(() => r.enter('/a')).not.toThrow();
  });

  it('caps depth at max', () => {
    const r = new IncludeResolver({ maxDepth: 2 });
    r.enter('/a');
    r.enter('/b');
    expect(() => r.enter('/c')).toThrow(/max include depth/i);
  });
});
