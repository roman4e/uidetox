import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
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
