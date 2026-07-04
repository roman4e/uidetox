import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, resolveImport } from '../../../src/compiler/dtx/resolve.js';

describe('config + resolver', () => {
  it('loads detox.toml', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cfg-'));
    writeFileSync(join(dir, 'detox.toml'), `[resolve]\nincludes = ["shared"]\nextensions = [".dtx"]\n`);
    const cfg = loadConfig(dir);
    expect(cfg.resolve.includes).toEqual(['shared']);
    expect(cfg.resolve.extensions).toEqual(['.dtx']);
  });

  it('falls back to detox.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cfg-'));
    writeFileSync(join(dir, 'detox.json'), JSON.stringify({ resolve: { includes: ['x'] } }));
    const cfg = loadConfig(dir);
    expect(cfg.resolve.includes).toEqual(['x']);
  });

  it('defaults when no config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cfg-'));
    const cfg = loadConfig(dir);
    expect(cfg.resolve.extensions).toEqual(['.dtx', '.md']);
  });

  it('resolves a bare import by filename in fromDir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'res-'));
    writeFileSync(join(dir, 'app-counter.dtx'), 'component X tag x-x\n');
    const cfg = loadConfig(dir);
    const path = resolveImport('app-counter', dir, cfg, dir);
    expect(path).toBe(join(dir, 'app-counter.dtx'));
  });

  it('resolves via includes', () => {
    const root = mkdtempSync(join(tmpdir(), 'res-'));
    mkdirSync(join(root, 'components'), { recursive: true });
    writeFileSync(join(root, 'components', 'big-number.md'), '---\ntag: big-number\n---\n');
    const cfg = { resolve: { includes: ['components'], extensions: ['.dtx', '.md'] }, build: {} };
    const path = resolveImport('big-number', root, cfg, root);
    expect(path).toBe(join(root, 'components', 'big-number.md'));
  });
});
