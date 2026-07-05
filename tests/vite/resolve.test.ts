import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDottedSpecifier, resolveDottedModule } from '../../src/vite/resolve.js';
import type { DetoxConfig } from '../../src/compiler/dtx/resolve.js';

describe('isDottedSpecifier', () => {
  it('matches dotted refs, rejects paths and single words', () => {
    expect(isDottedSpecifier('pages.Login')).toBe(true);
    expect(isDottedSpecifier('lib.auth-guard')).toBe(true);
    expect(isDottedSpecifier('components.NumericInput')).toBe(true);
    expect(isDottedSpecifier('uidetox/forms')).toBe(false); // slash
    expect(isDottedSpecifier('./x.dtx')).toBe(false);        // relative
    expect(isDottedSpecifier('lodash')).toBe(false);         // single segment
  });
});

describe('resolveDottedModule', () => {
  function cfg(includes: string[]): DetoxConfig {
    return { resolve: { includes, extensions: ['.dtx', '.md'] }, build: {} };
  }

  it('resolves <slash>.<ext> under an include root, preserving casing/kebab', () => {
    const root = mkdtempSync(join(tmpdir(), 'dtx-proj-'));
    mkdirSync(join(root, 'src', 'pages'), { recursive: true });
    writeFileSync(join(root, 'src', 'pages', 'Login.dtx'), '');
    const r = resolveDottedModule('pages.Login', cfg(['src']), root);
    expect(r.path).toBe(join(root, 'src', 'pages', 'Login.dtx'));
  });

  it('falls back to the package form <slash>/module.<ext>', () => {
    const root = mkdtempSync(join(tmpdir(), 'dtx-proj-'));
    mkdirSync(join(root, 'src', 'lib', 'auth-guard'), { recursive: true });
    writeFileSync(join(root, 'src', 'lib', 'auth-guard', 'module.dtx'), '');
    const r = resolveDottedModule('lib.auth-guard', cfg(['src']), root);
    expect(r.path).toBe(join(root, 'src', 'lib', 'auth-guard', 'module.dtx'));
  });

  it('returns null + tried paths on miss', () => {
    const root = mkdtempSync(join(tmpdir(), 'dtx-proj-'));
    const r = resolveDottedModule('pages.Missing', cfg(['src']), root);
    expect(r.path).toBeNull();
    expect(r.tried.length).toBeGreaterThan(0);
    expect(r.tried[0]).toContain('pages/Missing.dtx');
  });

  it('resolves a single-segment ref (Bug 10.3)', () => {
    const root = mkdtempSync(join(tmpdir(), 'dtx-proj-'));
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'routes.dtx'), '');
    const r = resolveDottedModule('routes', cfg(['src']), root);
    expect(r.path).toBe(join(root, 'src', 'routes.dtx'));
  });

  it('uses the config root when includes is empty', () => {
    const root = mkdtempSync(join(tmpdir(), 'dtx-proj-'));
    mkdirSync(join(root, 'pages'), { recursive: true });
    writeFileSync(join(root, 'pages', 'Home.dtx'), '');
    const r = resolveDottedModule('pages.Home', cfg([]), root);
    expect(r.path).toBe(join(root, 'pages', 'Home.dtx'));
  });
});
