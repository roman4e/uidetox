import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { DetoxConfig } from '../compiler/dtx/resolve.js';

// A dotted module ref: segment(.segment)+, no slashes, no relative prefix.
const DOTTED = /^[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)+$/;

export function isDottedSpecifier(spec: string): boolean {
  return DOTTED.test(spec);
}

export interface ResolveResult {
  /** Absolute path of the resolved module, or null on miss. */
  path: string | null;
  /** Every candidate path tried (for diagnostics). */
  tried: string[];
}

/**
 * Resolves a dotted module ref (`pages.Login`) to a file, searching each
 * `resolve.includes` root for `<slash>.<ext>` then the package form
 * `<slash>/module.<ext>`, over every `resolve.extensions`. Casing and kebab are
 * preserved (`lib.auth-guard` → `lib/auth-guard.dtx`).
 */
export function resolveDottedModule(
  spec: string,
  config: DetoxConfig,
  configRoot: string,
): ResolveResult {
  const slash = spec.replace(/\./g, '/');
  const roots = config.resolve.includes.length
    ? config.resolve.includes.map((inc) => (isAbsolute(inc) ? inc : join(configRoot, inc)))
    : [configRoot];
  const tried: string[] = [];
  for (const root of roots) {
    for (const ext of config.resolve.extensions) {
      const direct = join(root, `${slash}${ext}`);
      tried.push(direct);
      if (existsSync(direct)) return { path: direct, tried };
      const pkg = join(root, slash, `module${ext}`);
      tried.push(pkg);
      if (existsSync(pkg)) return { path: pkg, tried };
    }
  }
  return { path: null, tried };
}

/** Builds a helpful resolver-miss error listing every path tried. */
export function dottedMissError(spec: string, result: ResolveResult, configPath: string): Error {
  return new Error(
    `ui-detox: cannot resolve dotted module "${spec}".\n` +
      `Config: ${configPath}\n` +
      `Tried:\n${result.tried.map((p) => `  ${p}`).join('\n')}`,
  );
}
