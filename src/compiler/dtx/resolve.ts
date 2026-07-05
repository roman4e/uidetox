import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { parse as parseToml } from 'smol-toml';

export interface DetoxConfig {
  resolve: {
    includes: string[];
    extensions: string[];
  };
  build: Record<string, unknown>;
}

const DEFAULT_CONFIG: DetoxConfig = {
  resolve: { includes: [], extensions: ['.dtx', '.md'] },
  build: {},
};

function coerce(raw: unknown): DetoxConfig {
  const obj = (raw ?? {}) as { resolve?: { includes?: string[]; extensions?: string[] }; build?: Record<string, unknown> };
  return {
    resolve: {
      includes: obj.resolve?.includes ?? [],
      extensions: obj.resolve?.extensions ?? ['.dtx', '.md'],
    },
    build: obj.build ?? {},
  };
}

export function loadConfig(dir: string): DetoxConfig {
  const tomlPath = join(dir, 'detox.toml');
  if (existsSync(tomlPath)) {
    return coerce(parseToml(readFileSync(tomlPath, 'utf8')));
  }
  const jsonPath = join(dir, 'detox.json');
  if (existsSync(jsonPath)) {
    return coerce(JSON.parse(readFileSync(jsonPath, 'utf8')));
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Resolves a bare import name (no `from`) to a file path.
 * Search order: fromDir, cwd, each config include (relative to configRoot).
 * Filename convention: `<name><ext>` for each configured extension.
 */
export function resolveImport(
  name: string,
  fromDir: string,
  config: DetoxConfig,
  configRoot: string,
): string | null {
  const dirs = [fromDir, process.cwd(), ...config.resolve.includes.map((inc) => (isAbsolute(inc) ? inc : join(configRoot, inc)))];
  for (const dir of dirs) {
    for (const ext of config.resolve.extensions) {
      const candidate = join(dir, `${name}${ext}`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

export interface SpecifierOptions {
  /** Directory of the importing file; enables filesystem resolution. */
  baseDir?: string;
  /** Extra roots searched Python-style when the module is not found beside the importer. */
  includes?: string[];
  /** File extensions to search (default `['.dtx']`). `.dtx`/`.md` compile to `.js`. */
  extensions?: string[];
}

function toRelative(baseDir: string, target: string): string {
  let rel = relative(baseDir, target).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  // Compiled component sources become `.js`; TS/JS modules drop the extension so
  // the bundler resolves them (`../tokens.ts` → `../tokens`).
  if (/\.(dtx|md)$/.test(rel)) return rel.replace(/\.(dtx|md)$/, '.js');
  return rel.replace(/\.(ts|tsx|js|mjs|cjs)$/, '');
}

/**
 * Resolves a `.dtx` import specifier (Python-style, dotted).
 *
 * - A specifier containing `/` is a bare/npm or explicit path — returned verbatim.
 * - Otherwise dots become path separators (`a.b` → `a/b`) and the module is looked
 *   up as `<slash><ext>`, then the package form `<slash>/module<ext>`, over every
 *   configured extension, first beside the importer (`baseDir`) then in each
 *   `includes` root (like Python's sys.path).
 * - A single-segment ref that matches nothing is a bare npm specifier → verbatim.
 * - A dotted ref that matches nothing falls back to `./<slash>.js`.
 */
export function resolveSpecifier(spec: string, opts: SpecifierOptions = {}): string {
  if (spec.includes('/')) return spec;
  const slash = spec.replace(/\./g, '/');
  const exts = opts.extensions?.length ? opts.extensions : ['.dtx'];
  if (opts.baseDir) {
    const roots = [opts.baseDir, ...(opts.includes ?? [])];
    for (const root of roots) {
      for (const ext of exts) {
        const direct = join(root, `${slash}${ext}`);
        if (existsSync(direct)) return toRelative(opts.baseDir, direct);
        const pkg = join(root, slash, `module${ext}`);
        if (existsSync(pkg)) return toRelative(opts.baseDir, pkg);
      }
    }
  }
  // Nothing matched on disk. A bare single-segment id → npm specifier (verbatim);
  // a dotted ref → best-effort compiled-relative path.
  if (!spec.includes('.')) return spec;
  return `./${slash}.js`;
}
